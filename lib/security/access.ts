import {sql} from 'drizzle-orm'
import {db} from '../db'
import {HttpError} from './http'

// A missing principal is public-only, never a trusted-operator wildcard.
export function documentScope(id:ReturnType<typeof sql>, userId:string|null=null,write=false) {
  return sql`EXISTS (SELECT 1 FROM document_access access WHERE access.document_id = ${id}
    AND (${write ? sql`false` : sql`access.visibility = 'public'`} OR
      (access.visibility = 'private' AND access.owner_id = ${userId})))`
}
export async function requireDocument(id:number,userId:string|null,write=false) {
  const rows=await db.execute(sql`SELECT id FROM documents WHERE id=${id} AND ${documentScope(sql`documents.id`,userId,write)}`)
  if (!rows.rows.length) throw new HttpError(404,'Document unavailable')
}
