import {sql} from 'drizzle-orm'
import {db} from '../db'
import {HttpError} from './http'
export const quotas={authAccount:{max:10,seconds:300},registrationDay:{max:10,seconds:86400},registrationTotal:{max:100,seconds:315360000},workspaceUploadUser:{max:2,seconds:86400},workspaceUploadGlobal:{max:10,seconds:86400},embeddingBytes:{max:12000,seconds:60},embeddingMinute:{max:20,seconds:60},embeddingDay:{max:200,seconds:86400},demoUser:{max:2,seconds:60},demoMinute:{max:4,seconds:60},demoDay:{max:50,seconds:86400},feedback:{max:60,seconds:60},auth:{max:30,seconds:300},upload:{max:5,seconds:300},chat:{max:30,seconds:60},evaluation:{max:5,seconds:300},read:{max:120,seconds:60},public:{max:60,seconds:60}} as const
// PostgreSQL makes increments atomic across workers/instances. No forwarded IP trust.
export async function consumeLimit(kind:keyof typeof quotas,identity:string|null,amount=1) {
  if(!Number.isSafeInteger(amount)||amount<1)throw new Error('Invalid quota amount')
  const quota=quotas[kind],key=`${kind}:${identity ?? 'anonymous-global'}`
  const result=await db.execute(sql`INSERT INTO request_limits (key,count,reset_at)
    VALUES (${key},${amount},clock_timestamp()+${quota.seconds}*interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count=CASE WHEN request_limits.reset_at<=clock_timestamp() THEN ${amount} ELSE request_limits.count+${amount} END,
      reset_at=CASE WHEN request_limits.reset_at<=clock_timestamp() THEN clock_timestamp()+${quota.seconds}*interval '1 second' ELSE request_limits.reset_at END
    RETURNING count, GREATEST(1,CEIL(EXTRACT(epoch FROM reset_at-clock_timestamp()))) AS retry`)
  const row=result.rows[0] as {count:number;retry:string}
  if(row.count>quota.max) throw new HttpError(429,'Too many requests; try again later',Number(row.retry))
}
