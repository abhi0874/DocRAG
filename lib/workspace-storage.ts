import {sql} from 'drizzle-orm'
import {db} from './db'
import {demoEnabled} from './demo-config'
import {workspaceEnabled,workspaceLimits} from './workspace-config'
import {HttpError} from './security/http'

export function hostedWorkspace(){return workspaceEnabled() && demoEnabled()}
export async function checkWorkspaceCapacity(userId:string) {
  if(!hostedWorkspace())return
  const result=await db.execute(sql`SELECT count(*) AS total,count(*) FILTER (WHERE owner_id=${userId}) AS owned FROM document_access WHERE visibility='private'`)
  if(Number(result.rows[0].total)>=workspaceLimits.documentsGlobal || Number(result.rows[0].owned)>=workspaceLimits.documentsPerUser) throw new HttpError(429,'Document storage limit reached; delete a document before uploading',3600)
}
/** Only expiry-tagged opt-in uploads are eligible. Historical documents are untouched. */
export async function expireWorkspaceDocuments() {
  if(!hostedWorkspace())return
  await db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(68749321)`)
    const expired=sql`SELECT p.document_id FROM workspace_document_policy p JOIN document_access a ON a.document_id=p.document_id WHERE p.expires_at<=clock_timestamp() AND a.visibility='private'`
    await tx.execute(sql`DELETE FROM chunks WHERE document_id IN (${expired})`)
    await tx.execute(sql`DELETE FROM evaluations WHERE document_id IN (${expired})`)
    await tx.execute(sql`DELETE FROM documents WHERE id IN (${expired})`)
  })
}
