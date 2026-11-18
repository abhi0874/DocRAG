import {rejectDemoWrite} from '@/lib/demo-access'
import {observed} from '@/lib/observability/http'
import {desc, sql,getTableColumns} from 'drizzle-orm'
import {db} from '@/lib/db'
import {chunks, documents} from '@/lib/db/schema'
import {documentAccess,documentFiles} from '@/lib/db/security-schema'
import {chunkPages, embedChunks} from '@/lib/rag'
import {checkOrigin,principal,safeError,HttpError} from '@/lib/security/http'
import {documentScope} from '@/lib/security/access'
import {consumeLimit} from '@/lib/security/limits'
import {readPdf,parsePdf} from '@/lib/security/pdf'
import {acquireWork} from '@/lib/security/work'
import {demoEnabled} from '@/lib/demo-config'
import {workspaceEnabled,workspaceLimits} from '@/lib/workspace-config'
import {requireProcessingConsent} from '@/lib/workspace-consent'
import {consentVersion} from '@/lib/workspace-consent'
import {checkWorkspaceCapacity,expireWorkspaceDocuments} from '@/lib/workspace-storage'
export const maxDuration=120
async function handleGET(req:Request){
  try{
    const userId=await principal(req,false);await consumeLimit('read',userId)
    await expireWorkspaceDocuments()
    const params=new URL(req.url).searchParams
    if([...params.keys()].some(k=>k!=='offset'&&k!=='scope') || (params.has('scope') && !['mine','public'].includes(params.get('scope')!)))throw new HttpError(400,'Invalid pagination')
    if(params.get('scope')==='mine' && !userId) throw new HttpError(401,'Sign in required')
    const offset=params.get('offset')??'0'
    if(!/^\d{1,6}$/.test(offset))throw new HttpError(400,'Invalid pagination')
    const rows=await db.select({...getTableColumns(documents),owned:sql<boolean>`EXISTS(SELECT 1 FROM document_access a WHERE a.document_id=documents.id AND a.owner_id=${userId})`}).from(documents).where(documentScope(sql`documents.id`,params.get('scope')==='public'?null:userId,params.get('scope')==='mine'))
      .orderBy(desc(documents.createdAt)).limit(100).offset(Number(offset))
    return Response.json(rows,{headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
async function handlePOST(req:Request){
  let release:(()=>void)|undefined
  try{
    if(!workspaceEnabled()) rejectDemoWrite()
    requireProcessingConsent(req)
    checkOrigin(req);const userId=(await principal(req))!;await consumeLimit('upload',userId);release=acquireWork()
    const {bytes,filename}=await readPdf(req)
    const cloud=demoEnabled() && workspaceEnabled()
    if(cloud) {
      await expireWorkspaceDocuments();await checkWorkspaceCapacity(userId)
      if(bytes.length>workspaceLimits.fileBytes) throw new HttpError(413,'Hosted PDFs must be at most 2 MB')
      await consumeLimit('workspaceUploadUser',userId);await consumeLimit('workspaceUploadGlobal','global')
    }
    const {pages,totalPages}=await parsePdf(bytes)
    const textChunks=chunkPages(pages)
    if(!textChunks.length)throw new HttpError(400,'No extractable text found in this PDF')
    if(textChunks.length>500)throw new HttpError(413,'PDF has too much text')
    if(cloud && textChunks.length>workspaceLimits.chunksPerDocument) throw new HttpError(413,'This PDF exceeds the free indexing limit; upload a shorter document')
    // Complete external work before committing any document/chunk rows.
    const embeddings=await embedChunks(textChunks.map(c=>c.content),req.signal)
    if(req.signal.aborted)throw new HttpError(400,'Upload cancelled')
    const doc=await db.transaction(async tx=>{
      if(cloud) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(68749321)`)
        const counts=await tx.execute(sql`SELECT count(*) AS total, count(*) FILTER (WHERE owner_id=${userId}) AS owned FROM document_access WHERE visibility='private'`)
        if(Number(counts.rows[0].total)>=workspaceLimits.documentsGlobal || Number(counts.rows[0].owned)>=workspaceLimits.documentsPerUser) throw new HttpError(429,'Document storage limit reached; delete a document before uploading',3600)
      }
      const [created]=await tx.insert(documents).values({title:filename.replace(/\.pdf$/i,''),filename,
        pageCount:totalPages,chunkCount:textChunks.length,status:'ready'}).returning()
      await tx.insert(documentAccess).values({documentId:created.id,ownerId:userId,visibility:'private'})
      await tx.insert(documentFiles).values({documentId:created.id,bytes})
      if(cloud) await tx.execute(sql`INSERT INTO workspace_document_policy(document_id,expires_at,consent_version) VALUES(${created.id},clock_timestamp()+${workspaceLimits.retentionDays}*interval '1 day',${consentVersion})`)
      const rows=textChunks.map((c,i)=>({documentId:created.id,chunkIndex:c.chunkIndex,pageNumber:c.pageNumber,
        content:c.content,embedding:embeddings[i],metadata:c.metadata ? {...c.metadata,documentId:created.id,sourceDocument:filename,
          sourceId:`document:${created.id}:${c.metadata.sourceId}`,sectionId:`document:${created.id}:${c.metadata.sectionId}`} : null}))
      for(let i=0;i<rows.length;i+=50)await tx.insert(chunks).values(rows.slice(i,i+50))
      return created
    })
    return Response.json(doc,{status:201,headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}finally{release?.()}
}

export const GET=observed('/api/documents',handleGET)
export const POST=observed('/api/documents',handlePOST)
