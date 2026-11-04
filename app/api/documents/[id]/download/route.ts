import {and,eq,sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {documents} from '@/lib/db/schema'
import {documentFiles} from '@/lib/db/security-schema'
import {documentScope} from '@/lib/security/access'
import {principal,pathId,safeError,HttpError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const userId=await principal(req,false);await consumeLimit('read',userId)
    const id=pathId((await params).id)
    const [row]=await db.select({bytes:documentFiles.bytes}).from(documentFiles)
      .innerJoin(documents,eq(documents.id,documentFiles.documentId))
      .where(and(eq(documents.id,id),documentScope(sql`documents.id`,userId)))
    if(!row)throw new HttpError(404,'Document unavailable')
    return new Response(new Uint8Array(row.bytes),{headers:{'Content-Type':'application/pdf',
      'Content-Disposition':`attachment; filename="document-${id}.pdf"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
