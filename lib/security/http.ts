import {z} from 'zod'
import {appOrigin, getAuth} from '../auth'

export class HttpError extends Error {
  constructor(readonly status:number,message:string,readonly retryAfter?:number){super(message)}
}
export function safeError(error:unknown) {
  if (error instanceof HttpError) return Response.json({error:error.message},{status:error.status,
    headers:{'Cache-Control':'no-store',...(error.retryAfter ? {'Retry-After':String(error.retryAfter)}:{})}})
  return Response.json({error:'Request could not be completed'},{status:500,headers:{'Cache-Control':'no-store'}})
}
export function checkOrigin(req:Request) {
  const {origin,host}=appOrigin()
  if ((req.headers.get('host') ?? new URL(req.url).host)!==host) throw new HttpError(403,'Request origin is not allowed')
  if (req.headers.get('origin')!==origin || req.headers.get('sec-fetch-site')==='cross-site') throw new HttpError(403,'Request origin is not allowed')
}
export async function principal(req:Request, required=true) {
  const result=await getAuth().api.getSession({headers:req.headers,query:{disableCookieCache:true,disableRefresh:true}})
  if (!result && required) throw new HttpError(401,'Sign in required')
  return result?.user.id ?? null
}
export async function limitedBody(req:Request,limit:number) {
  const length=req.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length)>limit)) throw new HttpError(413,'Request is too large')
  const reader=req.body?.getReader(); const parts:Uint8Array[]=[]; let bytes=0
  if (!reader) return new Uint8Array()
  let expired=false
  const timer=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>{})},15000)
  try {
    while(true){ const item=await reader.read(); if(expired) throw new HttpError(408,'Request timed out'); if(item.done) break
      bytes+=item.value.byteLength
      if(bytes>limit){await reader.cancel();throw new HttpError(413,'Request is too large')}
      parts.push(item.value)
    }
  } finally {clearTimeout(timer);reader.releaseLock()}
  const body=new Uint8Array(bytes);let offset=0
  for(const part of parts){body.set(part,offset);offset+=part.byteLength}
  return body
}
export async function jsonBody<T>(req:Request,schema:z.ZodType<T>,limit=65536):Promise<T> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415,'Expected JSON')
  const body=await limitedBody(req,limit)
  let value:unknown
  try {value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body))} catch {throw new HttpError(400,'Invalid JSON')}
  const parsed=schema.safeParse(value)
  if(!parsed.success) throw new HttpError(400,'Invalid request')
  return parsed.data
}
export const documentId=z.number().int().positive().max(2147483647)
export function pathId(value:string) {
  if(!/^[1-9]\d{0,9}$/.test(value)) throw new HttpError(400,'Invalid document id')
  const parsed=documentId.safeParse(Number(value)); if(!parsed.success) throw new HttpError(400,'Invalid document id')
  return parsed.data
}
const message=z.object({id:z.string().min(1).max(128),role:z.enum(['user','assistant']),
  parts:z.array(z.object({type:z.literal('text'),text:z.string().min(1).max(8000)}).strict()).min(1).max(1)}).strict()
export const chatInput=z.object({documentId,messages:z.array(message).min(1).max(20)}).strict()
  .refine(v=>v.messages.at(-1)?.role==='user' && v.messages.reduce((n,m)=>n+m.parts[0].text.length,0)<=32000)
export const evaluationInput=z.object({documentId,question:z.string().trim().min(1).max(8000)}).strict()
