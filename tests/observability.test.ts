import {beforeEach,describe,expect,it,vi} from 'vitest'
import {currentTrace,newTrace,withTrace,measure,logRecord,tokenCount,type Trace} from '../lib/observability/context'
const mocks=vi.hoisted(()=>({persist:vi.fn(async(trace:unknown,latency:number)=>{void trace;void latency;return true})}))
vi.mock('../lib/observability/persist',()=>({persistMetric:mocks.persist}))
import {observed} from '../lib/observability/http'
import {answerMetadata,cachedAnswer,observeAnswer} from '../lib/observability/answer'
import type {TextStreamPart,ToolSet} from 'ai'
import type {DocumentSnapshot} from '../lib/evidence'
import manifest from '../lib/public-cache-manifest.json'
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AI_PROVIDER','ollama')})
const body=async(response:Response)=>{await response.text();return response}
const snapshot:DocumentSnapshot={document:{id:3,title:'private-title',filename:'private.pdf',status:'ready'},chunks:[],hash:manifest.documents[0].hash,isPublic:false}
const messages=[{id:'q',role:'user' as const,parts:[{type:'text' as const,text:'PRIVATE PROMPT'}]}]
const runStream=async(trace:Trace,parts:unknown[])=>{
 const stream=new ReadableStream<TextStreamPart<ToolSet>>({start(c){for(const p of parts)c.enqueue(p as TextStreamPart<ToolSet>);c.close()}})
 const reader=observeAnswer(stream,trace,answerMetadata(trace,snapshot,messages,[],'step5-v1')).getReader()
 while(!(await reader.read()).done){/* drain actual transform */}
}
describe('safe correlated telemetry',()=>{
 it('ignores caller IDs and generates unique UUIDs',async()=>{
  const route=observed('/test',async()=>Response.json({ok:true}))
  const ids=await Promise.all(Array.from({length:30},async()=> (await body(await route(new Request('http://localhost',{headers:{'X-Request-ID':'forged'}})))).headers.get('X-Request-ID')))
  expect(new Set(ids).size).toBe(30);expect(ids.every(id=>/^[0-9a-f-]{36}$/.test(id!))).toBe(true)
 })
 it('isolates concurrent stages and propagates the request ID',async()=>{
  const traces=Array.from({length:8},()=>newTrace('/test','GET'))
  await Promise.all(traces.map(t=>withTrace(t,()=>measure('retrieval',async()=>{await Promise.resolve();expect(currentTrace()?.id).toBe(t.id)}))))
  expect(traces.every(t=>t.timings.retrieval!>=0)).toBe(true)
 })
 it('serializes only safe fields, even if the trace contains secrets',()=>{
  const t=Object.assign(newTrace('/api/chat','POST'),{ownerId:'SECRET',answer:{publicAnswer:'SECRET'},headers:{cookie:'SECRET'},prompt:'SECRET',error:new Error('SECRET')})
  const text=JSON.stringify(logRecord('request.finished',t as Trace))
  expect(text).not.toContain('SECRET');expect(JSON.parse(text).route).toBe('/api/chat')
 })
 it.each([undefined,null,-1,1.5,NaN,Infinity,'10',Number.MAX_SAFE_INTEGER+1])('keeps invalid or absent usage %s unknown',v=>expect(tokenCount(v)).toBeNull())
 it('accepts only measured integer usage, including an explicit zero',()=>{expect(tokenCount(0)).toBe(0);expect(tokenCount(42)).toBe(42)})
 it.each([[200,'completed',null],[400,'failed','invalid_input'],[401,'failed','authentication'],[429,'failed','rate_limit'],[500,'failed','internal']])('records status %s accurately',async(status,outcome,category)=>{
  const r=await observed('/test',async()=>new Response('ok',{status:Number(status)}))(new Request('http://localhost'))
  await r.text();expect(mocks.persist).toHaveBeenCalledTimes(1)
  expect(mocks.persist.mock.calls[0][0]).toMatchObject({status,outcome,errorCategory:category})
 })
 it('does not expose uncaught exception content',async()=>{
  const r=await observed('/test',async()=>{throw new Error('SECRET')})(new Request('http://localhost'))
  expect(r.status).toBe(500);expect(await r.text()).not.toContain('SECRET')
 })
 it('persists a cancelled stream only once',async()=>{
  const r=await observed('/test',async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('first'))}})))(new Request('http://localhost'))
  const reader=r.body!.getReader();await reader.read();await reader.cancel();expect(mocks.persist).toHaveBeenCalledTimes(1)
  expect(mocks.persist.mock.calls[0][0]).toMatchObject({outcome:'cancelled'})
 })
 it('corrects cancellation during the metric write',async()=>{
  const abort=new AbortController()
  mocks.persist.mockImplementationOnce(async()=>{abort.abort();return true})
  await body(await observed('/test',async()=>Response.json({ok:true}))(new Request('http://localhost',{signal:abort.signal})))
  expect(mocks.persist).toHaveBeenCalledTimes(2);expect(mocks.persist.mock.calls[1][0]).toMatchObject({outcome:'cancelled'})
 })
 it('keeps successful output intact when persistence reports failure',async()=>{
  mocks.persist.mockResolvedValueOnce(false)
  const r=await observed('/test',async()=>Response.json({ok:true}))(new Request('http://localhost'))
  expect(await r.json()).toEqual({ok:true})
 })
 it('measures actual stream usage while retaining only private answer hashes',async()=>{
  const t=newTrace('/api/chat','POST')
  await runStream(t,[{type:'text-delta',text:'PRIVATE ANSWER'},{type:'finish',finishReason:'stop',totalUsage:{inputTokens:11,outputTokens:3,totalTokens:14}}])
  expect(t).toMatchObject({inputTokens:11,outputTokens:3,totalTokens:14,failed:false})
  expect(t.answer).toMatchObject({publicAnswer:null,publicQuestionHash:null});expect(JSON.stringify(t)).not.toContain('PRIVATE')
  expect(t.firstTokenMs).toBeGreaterThanOrEqual(0);expect(t.generationMs).toBeGreaterThanOrEqual(0)
 })
 it('does not manufacture unreported tokens',async()=>{
  const t=newTrace('/api/chat','POST');await runStream(t,[{type:'text-delta',text:'a'},{type:'finish',finishReason:'stop',totalUsage:{}}]);expect(t.totalTokens).toBeNull()
 })
 it.each(['length','error'])('refuses a feedback receipt for incomplete generation %s',async reason=>{
  const t=newTrace('/api/chat','POST');await runStream(t,[{type:'text-delta',text:'a'},{type:'finish',finishReason:reason,totalUsage:{}}]);expect(t.failed).toBe(true);expect(t.answer).toBeUndefined()
 })
 it('distinguishes cache savings from current measured tokens',()=>{
  const t=newTrace('/api/chat','POST');cachedAnswer(t,answerMetadata(t,snapshot,messages,[],'step5-v1'),'answer',23)
  expect(t).toMatchObject({generationSkipped:true,modelCallsAvoided:1,tokensAvoided:23,totalTokens:null,inputTokens:null,outputTokens:null})
 })
})
it('H: a signal after completed response cannot mutate its persisted outcome',async()=>{
 const abort=new AbortController();const r=await observed('/test',async()=>Response.json({ok:true}))(new Request('http://localhost',{signal:abort.signal}))
 await r.text();abort.abort();expect(mocks.persist).toHaveBeenCalledTimes(1)
 expect(mocks.persist.mock.calls[0][0]).toMatchObject({outcome:'completed',cancelled:false})
})
it('freezes cancellation category while late provider cleanup mutates the live trace',async()=>{
 const abort=new AbortController();let live:Trace|undefined
 const response=await observed('/test',async()=>{live=currentTrace();return Response.json({ok:true})})(new Request('http://localhost',{signal:abort.signal}))
 mocks.persist.mockImplementationOnce(async()=>{live!.errorCategory='model';live!.failed=true;return true})
 abort.abort();await response.text()
 expect(mocks.persist.mock.calls[0][0]).toMatchObject({outcome:'cancelled',errorCategory:'cancelled'})
})
it('exports only answers whose every source belongs to the allowlisted public document',()=>{
 const question=[{id:'q',role:'user' as const,parts:[{type:'text' as const,text:'In FastAPI, what Python value does item_id: int receive for /items/3?'}]}]
 const first={...snapshot,isPublic:true}
 const source={id:1,documentId:3,pageNumber:1,chunkIndex:0,content:'Public example.',vectorScore:1,keywordScore:null,rrfScore:1}
 const metadata=(sources:typeof source[])=>answerMetadata(newTrace('/api/chat','POST'),first,question,sources,'grounded-v1')
 expect(metadata([source])?.publicQuestionHash).toBeTruthy()
 expect(metadata([source,{...source,documentId:99}])?.publicQuestionHash).toBeNull()
 expect(metadata([])?.publicQuestionHash).toBeNull()
})
