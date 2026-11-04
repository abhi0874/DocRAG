import {sql} from 'drizzle-orm'
import {db} from '../db'
import {HttpError} from './http'
export const quotas={auth:{max:30,seconds:300},upload:{max:5,seconds:300},chat:{max:30,seconds:60},evaluation:{max:5,seconds:300},read:{max:120,seconds:60},public:{max:60,seconds:60}} as const
// PostgreSQL makes increments atomic across workers/instances. No forwarded IP trust.
export async function consumeLimit(kind:keyof typeof quotas,identity:string|null) {
  const quota=quotas[kind],key=`${kind}:${identity ?? 'anonymous-global'}`
  const result=await db.execute(sql`INSERT INTO request_limits (key,count,reset_at)
    VALUES (${key},1,clock_timestamp()+${quota.seconds}*interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count=CASE WHEN request_limits.reset_at<=clock_timestamp() THEN 1 ELSE request_limits.count+1 END,
      reset_at=CASE WHEN request_limits.reset_at<=clock_timestamp() THEN clock_timestamp()+${quota.seconds}*interval '1 second' ELSE request_limits.reset_at END
    RETURNING count, GREATEST(1,CEIL(EXTRACT(epoch FROM reset_at-clock_timestamp()))) AS retry`)
  const row=result.rows[0] as {count:number;retry:string}
  if(row.count>quota.max) throw new HttpError(429,'Too many requests; try again later',Number(row.retry))
}
