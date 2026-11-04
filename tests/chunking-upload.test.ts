import './security-route-fixture'
import {expect,it,vi} from 'vitest'
vi.mock('@/lib/db',()=>({db:{transaction:vi.fn()}}))
vi.mock('@/lib/rag',()=>({chunkPages:vi.fn(),embedChunks:vi.fn()}))
vi.mock('@/lib/security/pdf',async original=>({...await original<typeof import('@/lib/security/pdf')>(),parsePdf:vi.fn()}))
import {db} from '@/lib/db'
import {chunkPages as realChunks} from '@/lib/chunking'
import {chunkPages,embedChunks} from '@/lib/rag'
import {parsePdf} from '@/lib/security/pdf'
import {POST} from '@/app/api/documents/route'
it('persists actual PDF page, document, source and section metadata with corresponding vectors',async()=>{
 vi.mocked(parsePdf).mockResolvedValue({pages:['','# Overview\nPublic evidence.'],totalPages:2})
 const pieces=realChunks(['','# Overview\nPublic evidence.'],{algorithm:'heading-v1',size:1400,overlap:280})
 vi.mocked(chunkPages).mockReturnValue(pieces);vi.mocked(embedChunks).mockResolvedValue([[0.1,0.2]])
 const inserted=vi.fn().mockReturnValue({returning:async()=>[{id:42,status:'ready'}]})
 vi.mocked(db.transaction).mockImplementation(async fn=>fn({insert:()=>({values:inserted})} as never))
 const body=new FormData();body.set('file',new File(['%PDF-1.7\nfixture'],'guide.pdf',{type:'application/pdf'}))
 const response=await POST(new Request('http://localhost/api/documents',{method:'POST',headers:{Origin:'http://localhost'},body}))
 expect(response.status).toBe(201)
 expect(inserted).toHaveBeenCalledWith([expect.objectContaining({documentId:42,pageNumber:2,chunkIndex:0,embedding:[0.1,0.2],metadata:expect.objectContaining({documentId:42,sourceDocument:'guide.pdf',sourceId:'document:42:page:2',sectionId:'document:42:page:2:section:0',sectionTitle:'Overview',configId:'heading-v1-1400-280'})})])
 expect(inserted).toHaveBeenCalledWith({documentId:42,ownerId:'unit-user',visibility:'private'})
})
