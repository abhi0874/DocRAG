import './security-route-fixture'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {TextStreamPart,ToolSet} from 'ai'
vi.mock('@/lib/db',()=>({db:{}}))
vi.mock('@/lib/select-context',()=>({selectContext:vi.fn()}))
vi.mock('@/lib/rag-answer',async original=>({...await original<typeof import('@/lib/rag-answer')>(),startRagAnswer:vi.fn()}))
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
function request(q=question) {return new Request('http://localhost/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://localhost'},body:JSON.stringify({documentId:docId,messages:[{id:'test',role:'user',parts:[{type:'text',text:q}]}]})})}
function output(text='It receives integer 3 [1].', reason='stop', error=false) {
 const parts=[{type:'start'},{type:'text-start',id:'a'},{type:'text-delta',id:'a',text},{type:'text-end',id:'a'},
   ...(error?[{type:'error',error:new Error('simulated')}]:[]),{type:'finish',finishReason:reason,totalUsage:{totalTokens:30}}] as TextStreamPart<ToolSet>[]
 return {stream:new ReadableStream<TextStreamPart<ToolSet>>({start(c){parts.forEach(p=>c.enqueue(p));c.close()}})} as Awaited<ReturnType<typeof startRagAnswer>>
}
beforeEach(()=>{
 vi.clearAllMocks();versionHash=manifest.documents[0].hash;responseCache.invalidateDocument(docId)
 vi.stubEnv('AI_PROVIDER','ollama');vi.stubEnv('RESPONSE_CACHE_ENABLED','true');vi.stubEnv('DOCRAG_CHUNKING_EXPERIMENT',manifest.experiment)
 vi.mocked(documentSnapshot).mockImplementation(async()=>({document:{id:docId,title:'Public',filename:'public.pdf',status:'ready'},chunks:[{...source,metadata:null}],hash:versionHash,isPublic:true}))
 vi.mocked(selectContext).mockResolvedValue({ranked:[source],candidates:[source],hybrid_ms:1,selection_ms:1,trace:{status:'disabled',candidates:1,elapsed_ms:0}})
 vi.mocked(startRagAnswer).mockImplementation(async()=>output())
})
afterEach(()=>{vi.unstubAllEnvs();responseCache.invalidateDocument(docId)})
async function read() {const r=await POST(request());const body=await r.text();return {status:r.headers.get('X-DocRAG-Cache'),body}}

it.each([
  ['single backtick control', 'The value is 3 [1].\n`x = 3`\nAccording to source [-1], the value is 3.'],
  ['three backtick inline sample', 'The value is 3 [1].\n```x = 3```\nAccording to source [-1], the value is 3.'],
])('rejects plain negative attribution after a closed code example: %s', async (name, answer) => {
  vi.mocked(startRagAnswer).mockImplementation(async () => output(answer))
  const first = await read(), second = await read()
  const validation = first.body.split('\n').find(line => line.includes('data-validation'))
  console.log(JSON.stringify({name, first:first.status,second:second.status,stored:responseCache.size,generations:vi.mocked(startRagAnswer).mock.calls.length,validation}))
  expect(first.status).toBe('MISS')
  expect(second.status).toBe('MISS')
  expect(responseCache.size).toBe(0)
  expect(startRagAnswer).toHaveBeenCalledTimes(2)
  expect(validation).toContain('"valid":false')
})
