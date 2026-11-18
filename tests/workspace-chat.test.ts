import './security-route-fixture'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
vi.mock('@/lib/db',()=>({db:{}}))
vi.mock('@/lib/select-context',()=>({selectContext:vi.fn()}))
vi.mock('@/lib/rag-answer',async original=>({...await original<typeof import('@/lib/rag-answer')>(),startRagAnswer:vi.fn()}))
vi.mock('@/lib/evidence',async original=>({...await original<typeof import('@/lib/evidence')>(),documentSnapshot:vi.fn()}))
vi.mock('@/lib/public-cache-policy',()=>({publicCacheScope:()=>null}))
import {POST} from '@/app/api/chat/route'
import {selectContext} from '@/lib/select-context'
import {startRagAnswer} from '@/lib/rag-answer'
import {documentSnapshot} from '@/lib/evidence'
import {persistMetric} from '@/lib/observability/persist'
import * as auth from '@/lib/auth'
function source(id:number){return {id:id*10,content:`Document ${id} reports a public synthetic result.`,pageNumber:1,chunkIndex:0,vectorScore:.8,keywordScore:.2,rrfScore:.03}}
function request(ids=[1,2],followup=false){return new Request('http://localhost/api/chat',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({documentIds:ids,messages:[...(followup?[{id:'old',role:'user',parts:[{type:'text',text:'What is the launch date?'}]}]:[]),{id:'q',role:'user',parts:[{type:'text',text:followup?'Explain that.':'Compare the results.'}]}]})})}
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','true');vi.stubEnv('DOCRAG_DEPLOYMENT','local');vi.stubEnv('AI_PROVIDER','ollama')
  vi.mocked(documentSnapshot).mockImplementation(async id=>({document:{id,title:`Fixture ${id}`,filename:'fixture.pdf',status:'ready'},isPublic:false,hash:`hash${id}`,chunks:[{...source(id),metadata:null}]}))
  vi.mocked(selectContext).mockImplementation(async(_q,id)=>({ranked:[source(id)],candidates:[source(id)],hybrid_ms:1,selection_ms:1,trace:{status:'disabled',candidates:1,elapsed_ms:0}}))
  vi.mocked(startRagAnswer).mockResolvedValue({stream:new ReadableStream({start(c){c.enqueue({type:'text-start',id:'answer'});c.enqueue({type:'text-delta',id:'answer',text:'{"support":"full","evidence":[{"citation":1,"quote":"reports a public synthetic result."}]}\nThe synthetic results differ [1][2].'});c.enqueue({type:'text-end',id:'answer'});c.enqueue({type:'finish',finishReason:'stop',totalUsage:{totalTokens:12}});c.close()}})} as never)
})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()})
it('authorizes every selected document before any retrieval or provider call',async()=>{
  vi.mocked(documentSnapshot).mockImplementation(async id=>id===2?null:{document:{id,title:'A',filename:'a.pdf',status:'ready'},isPublic:false,hash:'h',chunks:[]})
  const response=await POST(request());expect(response.status).toBe(404)
  expect(selectContext).not.toHaveBeenCalled();expect(startRagAnswer).not.toHaveBeenCalled()
})
it('keeps document identities and citation order in multi-document streams',async()=>{
  const response=await POST(request());expect(response.status).toBe(200)
  const text=await response.text();expect(text).toContain('"documentId":1');expect(text).toContain('"documentId":2');expect(text).toContain('[1][2]')
  expect(response.headers.get('X-DocRAG-Cache')).toBe('BYPASS')
  expect(startRagAnswer).toHaveBeenCalledWith(expect.any(Array),expect.arrayContaining([expect.objectContaining({documentId:1}),expect.objectContaining({documentId:2})]),'grounded-v1',expect.any(AbortSignal))
})
it('uses recent user questions for follow-up retrieval',async()=>{
  await(await POST(request([1],true))).text()
  expect(vi.mocked(selectContext).mock.calls[0][0]).toBe('What is the launch date?\nExplain that.')
})
it('does not disguise retrieval failures as missing evidence',async()=>{
  vi.mocked(selectContext).mockRejectedValue(new Error('private database failure'))
  const response=await POST(request());expect(response.status).toBe(500)
  expect(await response.text()).not.toMatch(/private database|could not find/)
  expect(startRagAnswer).not.toHaveBeenCalled()
})
it('preserves the sample-only deployment boundary when the feature is off',async()=>{
  vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','false');const response=await POST(request());expect(response.status).toBe(400);expect(selectContext).not.toHaveBeenCalled()
})
it('answers a guest free-form question with the same evidence-checked stream',async()=>{
  vi.spyOn(auth,'getAuth').mockReturnValue({api:{getSession:async()=>null}} as never)
  vi.mocked(documentSnapshot).mockImplementation(async id=>({document:{id,title:'Public fixture',filename:'fixture.pdf',status:'ready'},isPublic:true,hash:'public',chunks:[{...source(id),metadata:null}]}))
  const response=await POST(request());const text=await response.text()
  expect(text).toContain('The synthetic results differ [1][2].')
  expect(text).not.toContain('"type":"error"')
  expect(selectContext).toHaveBeenCalledWith(expect.any(String),1,6,undefined,undefined,expect.any(Function),null)
})
it.each(['header-only','empty','truncated','missing-finalization'])('reports %s as generation failure, never a successful answer or no-evidence refusal',async mode=>{
  vi.mocked(startRagAnswer).mockResolvedValue({stream:new ReadableStream({start(c){
    c.enqueue({type:'text-start',id:'answer'})
    if(mode!=='empty')c.enqueue({type:'text-delta',id:'answer',text:'{"support":"full","evidence":[{"citation":1,"quote":"reports a public synthetic result."}]}\n'+(mode==='header-only'?'':'Partial result [1].')})
    c.enqueue({type:'text-end',id:'answer'})
    if(mode!=='missing-finalization')c.enqueue({type:'finish',finishReason:mode==='truncated'?'length':'stop',totalUsage:{totalTokens:12}})
    c.close()
  }})} as never)
  const body=await(await POST(request([1]))).text()
  expect(body).toContain('The answer was incomplete. Please try again.')
  expect(body).not.toContain('I could not find this in the document.')
  expect(body).not.toContain('"type":"data-validation"')
  const trace=vi.mocked(persistMetric).mock.calls[0][0]
  expect(trace).toMatchObject({outcome:'failed',errorCategory:'incomplete_generation'})
  expect(trace.answer).toBeUndefined()
})
it('keeps the guest view public even for a signed-in document owner',async()=>{
  vi.mocked(documentSnapshot).mockImplementation(async (id,userId)=>userId ? {
    document:{id,title:'Owned fixture',filename:'owned.pdf',status:'ready'},isPublic:false,hash:'private',chunks:[],
  } : null)
  const base=request([1])
  const payload={...await base.json(),personal:false}
  const response=await POST(new Request(base.url,{method:'POST',headers:base.headers,body:JSON.stringify(payload)}))
  expect(response.status).toBe(404)
  expect(documentSnapshot).toHaveBeenCalledWith(1,null)
  expect(selectContext).not.toHaveBeenCalled()
})
