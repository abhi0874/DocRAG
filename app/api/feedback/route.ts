import {z} from 'zod'
import {sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {documentScope} from '@/lib/security/access'
import {principal,checkOrigin,jsonBody,HttpError,safeError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
import {observed} from '@/lib/observability/http'
const input=z.object({answerId:z.uuid(),value:z.enum(['up','down'])}).strict()
async function handleGET(req:Request){
  try{
    const owner=(await principal(req))!;await consumeLimit('read',owner)
    const params=new URL(req.url).searchParams
    if([...params.keys()].some(k=>k!=='answerId')||params.getAll('answerId').length!==1)throw new HttpError(400,'Invalid request')
    const parsed=z.uuid().safeParse(params.get('answerId'));if(!parsed.success)throw new HttpError(400,'Invalid request')
    const rows=await db.execute(sql`SELECT a.id AS "answerId",f.value FROM answer_receipts a
      JOIN request_metrics m ON m.request_id=a.id LEFT JOIN answer_feedback f ON f.answer_id=a.id AND f.owner_id=${owner}
      WHERE a.id=${parsed.data} AND a.owner_id=${owner} AND m.outcome='completed' AND ${documentScope(sql`a.document_id`,owner)}`)
    if(!rows.rows.length)throw new HttpError(404,'Feedback unavailable for this response')
    return Response.json(rows.rows[0])
  }catch(error){return safeError(error)}
}
async function handlePOST(req:Request){
  try{
    checkOrigin(req);const owner=(await principal(req))!;await consumeLimit('feedback',owner)
    const {answerId,value}=await jsonBody(req,input,4096)
    const rows=await db.execute(sql`INSERT INTO answer_feedback(answer_id,owner_id,value)
      SELECT a.id,${owner},${value} FROM answer_receipts a JOIN request_metrics m ON m.request_id=a.id
      WHERE a.id=${answerId} AND a.owner_id=${owner} AND m.outcome='completed' AND ${documentScope(sql`a.document_id`,owner)}
      ON CONFLICT(answer_id) DO UPDATE SET value=EXCLUDED.value,updated_at=clock_timestamp()
      WHERE answer_feedback.owner_id=EXCLUDED.owner_id RETURNING answer_id AS "answerId",value`)
    if(!rows.rows.length)throw new HttpError(404,'Feedback unavailable for this response')
    return Response.json(rows.rows[0])
  }catch(error){return safeError(error)}
}
export const GET=observed('/api/feedback',handleGET)
export const POST=observed('/api/feedback',handlePOST)
