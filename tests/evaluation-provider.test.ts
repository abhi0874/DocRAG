import './security-route-fixture'
import {afterEach,expect,it,vi} from 'vitest'
vi.hoisted(() => {
 vi.stubEnv('AI_PROVIDER', 'gemini')
 vi.stubEnv('RAG_PROMPT_VERSION', 'grounded-v1')
})
vi.mock('@/lib/db',()=>({db:{insert:vi.fn(),transaction:vi.fn()}}))
vi.mock('@/lib/select-context',()=>({selectContext:vi.fn()}))
vi.mock('@/lib/evidence',()=>({documentSnapshot:vi.fn(async()=>({hash:'public'})),withEvidenceMetadata:(rows:unknown)=>rows}))
vi.mock('ai',async importOriginal=>({...await importOriginal<typeof import('ai')>(),generateText:vi.fn()}))
import {generateText} from 'ai'
import {POST} from '@/app/api/evaluations/route'
import {selectContext} from '@/lib/select-context'
import {db} from '@/lib/db'
import {CHAT_MODEL} from '@/lib/rag'
afterEach(()=>vi.unstubAllEnvs())
it('preserves Gemini abstraction and separate RAG/non-RAG calls with grounded citations',async()=>{
 expect(CHAT_MODEL.provider).toContain('google')
 const source={id:7,content:'COMMIT commits.',pageNumber:1,chunkIndex:0,vectorScore:1,keywordScore:null,rrfScore:.1}
 vi.mocked(selectContext).mockResolvedValue({ranked:[source],candidates:[source],hybrid_ms:1,selection_ms:1,trace:{status:'disabled',candidates:1,elapsed_ms:0}})
 vi.mocked(generateText).mockResolvedValueOnce({text:'COMMIT commits [1].'} as never).mockResolvedValueOnce({text:'General answer.'} as never)
 const values=vi.fn((data:unknown)=>({returning:async()=>[{id:1,...data as object}]}))
 vi.mocked(db.insert).mockReturnValue({values} as never)
 vi.mocked(db.transaction).mockImplementation(async fn=>fn(db as never))
 const response=await POST(new Request('http://localhost/api/evaluations',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({documentId:3,question:'Which command commits?'})}))
 expect(response.status).toBe(200)
 expect(generateText).toHaveBeenNthCalledWith(1,expect.objectContaining({model:CHAT_MODEL,instructions:expect.stringContaining('Evidence JSON')}))
 expect(generateText).toHaveBeenNthCalledWith(2,expect.objectContaining({model:CHAT_MODEL,instructions:expect.stringContaining('general knowledge only')}))
 const result=await response.json();expect(result.citationValidation).toMatchObject({valid:true,semanticSupport:'not-verified'})
 expect(result.ragAnswer).toBe('COMMIT commits [1].');expect(result.noRagAnswer).toBe('General answer.')
})
