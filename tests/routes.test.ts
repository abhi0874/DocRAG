import './security-route-fixture'
import {expect,it,vi} from 'vitest'
vi.mock('@/lib/db',()=>({db:{insert:vi.fn(),delete:vi.fn(),transaction:vi.fn()}}))
vi.mock('@/lib/rag',()=>({chunkPages:vi.fn(),embedChunks:vi.fn(),hybridSearch:vi.fn(),buildContext:vi.fn(),CHAT_MODEL:{},RAG_INSTRUCTIONS:''}))
vi.mock('@/lib/security/pdf',async original=>({...await original<typeof import('@/lib/security/pdf')>(),parsePdf:vi.fn()}))
import {POST as upload} from '@/app/api/documents/route'
import {POST as chat} from '@/app/api/chat/route'
import {POST as evaluate} from '@/app/api/evaluations/route'
import {DELETE as remove} from '@/app/api/documents/[id]/route'
import {db} from '@/lib/db'
import {chunkPages} from '@/lib/rag'
import {parsePdf} from '@/lib/security/pdf'
import {responseCache} from '@/lib/response-cache'
const formRequest=(body:FormData)=>new Request('http://localhost/api/documents',{method:'POST',headers:{Origin:'http://localhost'},body})
const jsonRequest=(body:unknown)=>new Request('http://localhost/api/chat',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(body)})
it('rejects an upload without a file',async()=>{
 const response=await upload(formRequest(new FormData()));expect(response.status).toBe(400);expect(await response.json()).toEqual({error:'No file provided'})
})
it('rejects non-PDF files before accessing the database',async()=>{
 const body=new FormData();body.set('file',new File(['Public text'],'document.txt'))
 expect((await upload(formRequest(body))).status).toBe(415);expect(db.insert).not.toHaveBeenCalled()
})
it('rejects a PDF with no extractable text',async()=>{
 vi.mocked(parsePdf).mockResolvedValue({pages:[],totalPages:1});vi.mocked(chunkPages).mockReturnValue([])
 const body=new FormData();body.set('file',new File(['%PDF-1.7\nfixture'],'public.pdf',{type:'application/pdf'}))
 const response=await upload(formRequest(body));expect(response.status).toBe(400)
 expect((await response.json()).error).toContain('No extractable text');expect(db.insert).not.toHaveBeenCalled()
})
it('requires a selected document for chat',async()=>{expect((await chat(jsonRequest({messages:[]}))).status).toBe(400)})
it('requires a question for comparisons',async()=>{expect((await evaluate(jsonRequest({documentId:1,question:' '}))).status).toBe(400)})
it('rejects a noninteger deletion id before database access',async()=>{
 expect((await remove(new Request('http://localhost',{method:'DELETE',headers:{Origin:'http://localhost'}}),{params:Promise.resolve({id:'abc'})})).status).toBe(400)
 expect(db.delete).not.toHaveBeenCalled()
})
it('successful deletion invalidates only the selected document cache',async()=>{
 responseCache.set('deleted-document','public',901,{text:'Old answer',tokens:1});responseCache.set('other-document','public',902,{text:'Other answer',tokens:1})
 const tx={select:()=>({from:()=>({where:()=>({for:async()=>[{id:901}]})})}),delete:()=>({where:async()=>undefined})}
 vi.mocked(db.transaction).mockImplementation(async fn=>fn(tx as never))
 try{const response=await remove(new Request('http://localhost',{method:'DELETE',headers:{Origin:'http://localhost'}}),{params:Promise.resolve({id:'901'})})
 expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});expect(responseCache.get('deleted-document','public')).toBeUndefined();expect(responseCache.get('other-document','public')?.text).toBe('Other answer')
 }finally{responseCache.invalidateDocument(901);responseCache.invalidateDocument(902)}
})
