import {sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {principal,HttpError,safeError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
import {observed} from '@/lib/observability/http'
async function handleGET(req:Request){
  try{
    const owner=(await principal(req))!;await consumeLimit('read',owner)
    const params=new URL(req.url).searchParams
    if([...params.keys()].some(k=>k!=='hours')||params.getAll('hours').length>1)throw new HttpError(400,'Invalid period')
    const hours=Number(params.get('hours')??24);if(![1,24,168].includes(hours))throw new HttpError(400,'Invalid period')
    const result=await db.transaction(async tx=>{
      await tx.execute(sql`SET LOCAL statement_timeout='2000ms'`)
      const scope=sql`owner_id=${owner} AND created_at>=clock_timestamp()-${hours}*interval '1 hour' AND route<>'/api/metrics'`
      const aggregate=await tx.execute(sql`SELECT count(*)::int AS total,
        count(*) FILTER(WHERE outcome='completed' AND status<400)::int AS successful,
        count(*) FILTER(WHERE outcome='failed')::int AS failed,
        count(*) FILTER(WHERE outcome='cancelled')::int AS cancelled,
        avg(latency_ms) AS mean_ms,percentile_cont(0.5) WITHIN GROUP(ORDER BY latency_ms) AS p50_ms,
        percentile_cont(0.95) WITHIN GROUP(ORDER BY latency_ms) AS p95_ms,
        count(*) FILTER(WHERE cache='HIT')::int AS cache_hits,count(*) FILTER(WHERE cache='MISS')::int AS cache_misses,
        sum(input_tokens)::float8 AS input_tokens,sum(output_tokens)::float8 AS output_tokens,sum(total_tokens)::float8 AS total_tokens,
        count(total_tokens)::int AS token_measurements FROM request_metrics WHERE ${scope}`)
      const providers=await tx.execute(sql`SELECT provider,count(*)::int AS count FROM request_metrics WHERE ${scope} GROUP BY provider`)
      const errors=await tx.execute(sql`SELECT error_category,count(*)::int AS count FROM request_metrics WHERE ${scope} AND error_category IS NOT NULL GROUP BY error_category`)
      const trends=await tx.execute(sql`SELECT date_trunc('hour',created_at) AS hour,count(*)::int AS count FROM request_metrics WHERE ${scope} GROUP BY 1 ORDER BY 1`)
      const recent=await tx.execute(sql`SELECT request_id,created_at,route,method,status,outcome,latency_ms,provider,cache,error_category FROM request_metrics WHERE ${scope} ORDER BY created_at DESC LIMIT 30`)
      return {summary:aggregate.rows[0],providers:providers.rows,errors:errors.rows,trends:trends.rows,recent:recent.rows}
    },{accessMode:'read only',isolationLevel:'repeatable read'})
    return Response.json({scope:'Your recorded requests',hours,...result},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
export const GET=observed('/api/metrics',handleGET)
