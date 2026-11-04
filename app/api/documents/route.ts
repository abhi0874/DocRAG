import {desc, sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {chunks, documents} from '@/lib/db/schema'
import {documentAccess,documentFiles} from '@/lib/db/security-schema'
import {chunkPages, embedChunks} from '@/lib/rag'
import {checkOrigin,principal,safeError,HttpError} from '@/lib/security/http'
import {documentScope} from '@/lib/security/access'
import {consumeLimit} from '@/lib/security/limits'
import {readPdf,parsePdf} from '@/lib/security/pdf'
import {acquireWork} from '@/lib/security/work'
export const maxDuration=120
export async function GET(req:Request){
  try{
    const userId=await principal(req,false);await consumeLimit('read',userId)
    const params=new URL(req.url).searchParams
    if([...params.keys()].some(k=>k!=='offset'))throw new HttpError(400,'Invalid pagination')
    const offset=params.get('offset')??'0'
    if(!/^\d{1,6}$/.test(offset))throw new HttpError(400,'Invalid pagination')
    const rows=await db.select().from(documents).where(documentScope(sql`documents.id`,userId))
      .orderBy(desc(documents.createdAt)).limit(100).offset(Number(offset))
    return Response.json(rows,{headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
export async function POST(req:Request){
  let release:(()=>void)|undefined
  try{
    checkOrigin(req);const userId=(await principal(req))!;await consumeLimit('upload',userId);release=acquireWork()
    const {bytes,filename}=await readPdf(req)
    const {pages,totalPages}=await parsePdf(bytes)
    const textChunks=chunkPages(pages)
    if(!textChunks.length)throw new HttpError(400,'No extractable text found in this PDF')
    if(textChunks.length>500)throw new HttpError(413,'PDF has too much text')
    // Complete external work before committing any document/chunk rows.
    const embeddings=await embedChunks(textChunks.map(c=>c.content))
    if(req.signal.aborted)throw new HttpError(400,'Upload cancelled')
    const doc=await db.transaction(async tx=>{
      const [created]=await tx.insert(documents).values({title:filename.replace(/\.pdf$/i,''),filename,
        pageCount:totalPages,chunkCount:textChunks.length,status:'ready'}).returning()
      await tx.insert(documentAccess).values({documentId:created.id,ownerId:userId,visibility:'private'})
      await tx.insert(documentFiles).values({documentId:created.id,bytes})
      const rows=textChunks.map((c,i)=>({documentId:created.id,chunkIndex:c.chunkIndex,pageNumber:c.pageNumber,
        content:c.content,embedding:embeddings[i],metadata:c.metadata ? {...c.metadata,documentId:created.id,sourceDocument:filename,
          sourceId:`document:${created.id}:${c.metadata.sourceId}`,sectionId:`document:${created.id}:${c.metadata.sectionId}`} : null}))
      for(let i=0;i<rows.length;i+=50)await tx.insert(chunks).values(rows.slice(i,i+50))
      return created
    })
    return Response.json(doc,{status:201,headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}finally{release?.()}
}
