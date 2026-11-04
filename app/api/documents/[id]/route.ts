import {and,eq,sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {chunks,documents,evaluations} from '@/lib/db/schema'
import {responseCache} from '@/lib/response-cache'
import {documentSnapshot} from '@/lib/evidence'
import {documentScope} from '@/lib/security/access'
import {checkOrigin,principal,pathId,safeError,HttpError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
type Context={params:Promise<{id:string}>}
export async function GET(req:Request,{params}:Context){
  try{
    const userId=await principal(req,false);await consumeLimit('read',userId)
    const result=await documentSnapshot(pathId((await params).id),userId)
    if(!result)throw new HttpError(404,'Document unavailable')
    return Response.json(result,{headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
export async function DELETE(req:Request,{params}:Context){
  try{
    checkOrigin(req);const userId=(await principal(req))!;await consumeLimit('read',userId)
    const id=pathId((await params).id)
    await db.transaction(async tx=>{
      const found=await tx.select({id:documents.id}).from(documents)
        .where(and(eq(documents.id,id),documentScope(sql`documents.id`,userId,true))).for('update')
      if(!found.length)throw new HttpError(404,'Document unavailable')
      await tx.delete(chunks).where(eq(chunks.documentId,id))
      await tx.delete(evaluations).where(eq(evaluations.documentId,id))
      await tx.delete(documents).where(and(eq(documents.id,id),documentScope(sql`documents.id`,userId,true)))
    })
    responseCache.invalidateDocument(id)
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
