import './security-route-fixture'
import {beforeEach,afterEach,expect,it,vi} from 'vitest'
vi.mock('@/lib/db',()=>({db:{}}))
vi.mock('@/lib/select-context',()=>({selectContext:vi.fn()}))
vi.mock('@/lib/rag-answer',()=>({startRagAnswer:vi.fn()}))
vi.mock('@/lib/evidence',async original=>({...await original<typeof import('@/lib/evidence')>(),documentSnapshot:vi.fn()}))
vi.mock('@/lib/public-cache-policy',()=>({publicCacheScope:()=>null}))
import {POST} from '@/app/api/chat/route'
import {selectContext} from '@/lib/select-context'
import {startRagAnswer} from '@/lib/rag-answer'
import {documentSnapshot} from '@/lib/evidence'
import {persistMetric} from '@/lib/observability/persist'
const source={id:1,content:'Public fixture.',pageNumber:1,chunkIndex:0,vectorScore:1,keywordScore:null,rrfScore:.02}
function request(signal:AbortSignal){return new Request('http://localhost/api/chat',{method:'POST',signal,headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({documentId:3,messages:[{id:'q',role:'user',parts:[{type:'text',text:'Question'}]}]})})}
beforeEach(()=>{
 vi.stubEnv('AI_PROVIDER','ollama')
 vi.mocked(documentSnapshot).mockResolvedValue({document:{id:3,title:'Public',filename:'test.pdf',status:'ready'},chunks:[{...source,metadata:null}],hash:'fixture',isPublic:true})
 vi.mocked(selectContext).mockResolvedValue({ranked:[source],candidates:[source],hybrid_ms:1,selection_ms:1,trace:{status:'disabled',candidates:1,elapsed_ms:0}})
})
afterEach(()=>vi.unstubAllEnvs())
it('A: cancellation before retrieval never starts retrieval or generation',async()=>{
 const abort=new AbortController();abort.abort();const response=await POST(request(abort.signal));await response.text()
 expect(selectContext).not.toHaveBeenCalled();expect(startRagAnswer).not.toHaveBeenCalled();expect(persistMetric).toHaveBeenCalledTimes(1)
 expect(vi.mocked(persistMetric).mock.calls[0][0].outcome).toBe('cancelled')
})
it('B/C: a request cancelled during retrieval waits for it and skips generation',async()=>{
 const abort=new AbortController();const entered=Promise.withResolvers<void>(),retrieved=Promise.withResolvers<Awaited<ReturnType<typeof selectContext>>>()
 vi.mocked(selectContext).mockImplementation(()=>{entered.resolve();return retrieved.promise})
 const response=POST(request(abort.signal));await entered.promise;abort.abort();abort.abort()
 retrieved.resolve({ranked:[source],candidates:[source],hybrid_ms:1,selection_ms:1,trace:{status:'disabled',candidates:1,elapsed_ms:0}})
 await (await response).text();expect(startRagAnswer).not.toHaveBeenCalled();expect(persistMetric).toHaveBeenCalledTimes(1)
 expect(vi.mocked(persistMetric).mock.calls[0][0].outcome).toBe('cancelled')
})
it('D/E/I: first-token disconnect cancels upstream and finalizes once',async()=>{
 const abort=new AbortController(),cancel=vi.fn()
 vi.mocked(startRagAnswer).mockResolvedValue({stream:new ReadableStream({start(c){c.enqueue({type:'text-start',id:'a'});c.enqueue({type:'text-delta',id:'a',text:'partial'})},cancel})} as never)
 const response=await POST(request(abort.signal));const reader=response.body!.getReader()
 let text='';while(!text.includes('partial')){const part=await reader.read();expect(part.done).toBe(false);text+=new TextDecoder().decode(part.value)}
 abort.abort();abort.abort();await reader.cancel()
 expect(cancel).toHaveBeenCalledTimes(1);expect(persistMetric).toHaveBeenCalledTimes(1)
 const trace=vi.mocked(persistMetric).mock.calls[0][0];expect(trace.outcome).toBe('cancelled');expect(trace.answer).toBeUndefined();expect(trace.totalTokens).toBeNull()
})
it('J: unrelated provider errors remain failed, not cancelled',async()=>{
 const abort=new AbortController()
 vi.mocked(startRagAnswer).mockRejectedValue(new Error('PRIVATE provider error'))
 const response=await POST(request(abort.signal));const body=await response.text()
 expect(body).toContain('could not be completed');expect(body).not.toContain('PRIVATE')
 expect(vi.mocked(persistMetric).mock.calls[0][0]).toMatchObject({outcome:'failed',errorCategory:'model',cancelled:false})
})
it('C: cancellation immediately after selection prevents model setup',async()=>{
 const abort=new AbortController()
 vi.mocked(selectContext).mockImplementation(async()=>{
  const selected={ranked:[source],candidates:[source],hybrid_ms:1,selection_ms:1,trace:{status:'disabled' as const,candidates:1,elapsed_ms:0}}
  queueMicrotask(()=>abort.abort());return selected
 })
 await (await POST(request(abort.signal))).text();expect(startRagAnswer).not.toHaveBeenCalled()
 expect(vi.mocked(persistMetric).mock.calls[0][0].outcome).toBe('cancelled')
})
it('D: cancellation while model setup is pending settles and cancels its eventual stream',async()=>{
 const abort=new AbortController(),entered=Promise.withResolvers<void>(),ready=Promise.withResolvers<Awaited<ReturnType<typeof startRagAnswer>>>(),cancel=vi.fn()
 vi.mocked(startRagAnswer).mockImplementation(()=>{entered.resolve();return ready.promise})
 const response=await POST(request(abort.signal));await entered.promise;abort.abort()
 ready.resolve({stream:new ReadableStream({cancel})} as never)
 await response.text();expect(cancel).toHaveBeenCalledTimes(1);expect(persistMetric).toHaveBeenCalledTimes(1)
 expect(vi.mocked(persistMetric).mock.calls[0][0]).toMatchObject({outcome:'cancelled'})
})
it('J: an AbortError without request cancellation remains an unexpected failure',async()=>{
 const abort=new AbortController();vi.mocked(startRagAnswer).mockRejectedValue(new DOMException('Unexpected upstream timeout','AbortError'))
 await (await POST(request(abort.signal))).text()
 expect(vi.mocked(persistMetric).mock.calls[0][0]).toMatchObject({outcome:'failed',cancelled:false,errorCategory:'model'})
})
