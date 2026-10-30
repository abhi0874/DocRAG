import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {TextStreamPart,ToolSet} from 'ai'
vi.mock('@/lib/db',()=>({db:{}}))
vi.mock('@/lib/select-context',()=>({selectContext:vi.fn()}))
vi.mock('@/lib/rag-answer',()=>({startRagAnswer:vi.fn()}))
vi.mock('@/lib/evidence',async importOriginal=>({...await importOriginal<typeof import('@/lib/evidence')>(),documentSnapshot:vi.fn()}))
vi.mock('@/lib/public-cache-policy',async importOriginal=>({...await importOriginal<typeof import('@/lib/public-cache-policy')>(),cacheModelIdentity:vi.fn(async()=>({digest:'pinned',runtime:'fixed'}))}))
import {POST} from '@/app/api/chat/route'
import {selectContext} from '@/lib/select-context'
import {startRagAnswer} from '@/lib/rag-answer'
import {documentSnapshot} from '@/lib/evidence'
import {responseCache} from '@/lib/response-cache'
import manifest from '@/lib/public-cache-manifest.json'
const question='In FastAPI, what Python value does item_id: int receive for /items/3?'
const source={id:1,content:'It receives the Python integer 3.',pageNumber:1,chunkIndex:0,vectorScore:1,keywordScore:null,rrfScore:.02}
let versionHash=manifest.documents[0].hash
const docId=manifest.documents[0].id
function request(q=question) {return new Request('http://localhost/api/chat',{method:'POST',body:JSON.stringify({documentId:docId,messages:[{id:'test',role:'user',parts:[{type:'text',text:q}]}]})})}
function output(text='It receives integer 3 [1].', reason='stop', error=false) {
 const parts=[{type:'start'},{type:'text-start',id:'a'},{type:'text-delta',id:'a',text},{type:'text-end',id:'a'},
   ...(error?[{type:'error',error:new Error('simulated')}]:[]),{type:'finish',finishReason:reason,totalUsage:{totalTokens:30}}] as TextStreamPart<ToolSet>[]
 return {stream:new ReadableStream<TextStreamPart<ToolSet>>({start(c){parts.forEach(p=>c.enqueue(p));c.close()}})} as Awaited<ReturnType<typeof startRagAnswer>>
}
beforeEach(()=>{
 vi.clearAllMocks();versionHash=manifest.documents[0].hash;responseCache.invalidateDocument(docId)
 vi.stubEnv('AI_PROVIDER','ollama');vi.stubEnv('RESPONSE_CACHE_ENABLED','true');vi.stubEnv('DOCRAG_CHUNKING_EXPERIMENT',manifest.experiment)
 vi.mocked(documentSnapshot).mockImplementation(async()=>({document:{id:docId,title:'Public',filename:'public.pdf',status:'ready'},chunks:[{...source,metadata:null}],hash:versionHash}))
 vi.mocked(selectContext).mockResolvedValue({ranked:[source],candidates:[source],hybrid_ms:1,selection_ms:1,trace:{status:'disabled',candidates:1,elapsed_ms:0}})
 vi.mocked(startRagAnswer).mockImplementation(async()=>output())
})
afterEach(()=>{vi.unstubAllEnvs();responseCache.invalidateDocument(docId)})
async function read() {const r=await POST(request());const body=await r.text();return {status:r.headers.get('X-DocRAG-Cache'),body}}
it('real UI protocol miss then hit avoids a second model generation and preserves sources',async()=>{
 const a=await read(),b=await read();expect(a.status).toBe('MISS');expect(b.status).toBe('HIT')
 expect(startRagAnswer).toHaveBeenCalledTimes(1);expect(b.body).toContain('data-sources');expect(b.body).toContain('tokensAvoided":30');expect(b.body).toContain('[DONE]')
})
it('changed document and prompt cannot return a stale hit',async()=>{
 await read();versionHash='replacement';expect((await read()).status).toBe('BYPASS')
 versionHash=manifest.documents[0].hash;vi.stubEnv('RAG_PROMPT_VERSION','step5-v1');expect((await read()).status).toBe('MISS')
 expect(startRagAnswer).toHaveBeenCalledTimes(3)
})
it('deleted document invalidates stored entries',async()=>{
 await read();expect(responseCache.size).toBeGreaterThan(0)
 vi.mocked(documentSnapshot).mockResolvedValue(null);const r=await POST(request());expect(r.status).toBe(404);expect(responseCache.size).toBe(0)
})
it('disabled cache and arbitrary private questions always generate',async()=>{
 vi.stubEnv('RESPONSE_CACHE_ENABLED','false');expect((await read()).status).toBe('BYPASS');expect((await read()).status).toBe('BYPASS')
 vi.stubEnv('RESPONSE_CACHE_ENABLED','true');const r=await POST(request('Private detail'));await r.text();expect(r.headers.get('X-DocRAG-Cache')).toBe('BYPASS');expect(responseCache.size).toBe(0)
})
it.each([['Wrong [99].','stop',false],['Partial [1].','length',false],['Failure [1].','stop',true]])('does not cache invalid or failed generation: %s',async(text,reason,error)=>{
 vi.mocked(startRagAnswer).mockImplementation(async()=>output(text as string,reason as string,error as boolean))
 await read();await read();expect(startRagAnswer).toHaveBeenCalledTimes(2);expect(responseCache.size).toBe(0)
})
it('concurrent duplicate requests have one cache writer without sharing partial streams',async()=>{
 const [a,b]=await Promise.all([POST(request()),POST(request())]);await Promise.all([a.text(),b.text()])
 expect([a.headers.get('X-DocRAG-Cache'),b.headers.get('X-DocRAG-Cache')].sort()).toEqual(['BYPASS_BUSY','MISS'])
 expect(responseCache.size).toBe(1);expect((await read()).status).toBe('HIT')
})
it('cancelled HTTP response is not cached and releases its writer',async()=>{
 vi.mocked(startRagAnswer).mockImplementation(async()=>({stream:new ReadableStream({start(c){c.enqueue({type:'start'});c.enqueue({type:'text-start',id:'a'});c.enqueue({type:'text-delta',id:'a',text:'Partial'})}})} as Awaited<ReturnType<typeof startRagAnswer>>))
 const r=await POST(request());const reader=r.body!.getReader();await reader.read();await reader.cancel()
 await new Promise(resolve=>setTimeout(resolve,0));expect(responseCache.size).toBe(0)
 vi.mocked(startRagAnswer).mockImplementation(async()=>output());expect((await read()).status).toBe('MISS')
})
it('a replacement during generation cannot commit the old answer',async()=>{
 vi.mocked(startRagAnswer).mockImplementation(async()=>{versionHash='changed-mid-stream';return output()})
 await read();expect(responseCache.size).toBe(0)
})

it('late cancellation after model completion but before HTTP EOF does not store',async()=>{
 const r=await POST(request())
 // Let the model complete into the SDK buffer without draining the HTTP body.
 await new Promise(resolve=>setTimeout(resolve,10))
 await r.body!.cancel();expect(responseCache.size).toBe(0)
 expect((await read()).status).toBe('MISS')
})

it('releases a cancelled cache owner exactly once across abort and stream cleanup',async()=>{
 const release=vi.spyOn(responseCache,'release')
 vi.mocked(startRagAnswer).mockImplementation(async()=>({stream:new ReadableStream({start(c){c.enqueue({type:'start'})}})} as Awaited<ReturnType<typeof startRagAnswer>>))
 const r=await POST(request());await r.body!.cancel();await new Promise(resolve=>setTimeout(resolve,0))
 expect(release).toHaveBeenCalledTimes(1);release.mockRestore()
})
