import { createHash } from 'node:crypto'
import { and, sql, eq } from 'drizzle-orm'
import { db } from './db'
import {documentScope} from './security/access'
import { chunks, documents } from './db/schema'
import type { RetrievedChunk } from './rag'

export const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export interface DocumentSnapshot {
  document: {id: number; title: string; filename: string; status: string}
  chunks: {id: number; chunkIndex: number; pageNumber: number; content: string; metadata: unknown}[]
  hash: string
  isPublic: boolean
}
export async function documentSnapshot(id: number,userId:string|null=null): Promise<DocumentSnapshot | null> {
  // One transaction gives a consistent document/content version, including during replacement.
  return db.transaction(async tx => {
    const [row] = await tx.select({id: documents.id, title: documents.title,
      filename: documents.filename, status: documents.status, isPublic:sql<boolean>`EXISTS(SELECT 1 FROM document_access WHERE document_id=documents.id AND visibility='public')`}).from(documents).where(and(eq(documents.id,id),documentScope(sql`documents.id`,userId)))
    if (!row || row.status !== 'ready') return null
    const {isPublic,...document}=row
    const rows = await tx.select({id: chunks.id, chunkIndex: chunks.chunkIndex, pageNumber: chunks.pageNumber,
      content: chunks.content, metadata: chunks.metadata}).from(chunks).where(eq(chunks.documentId, id)).orderBy(chunks.id)
    return {document, isPublic, chunks: rows, hash: digest({document, chunks: rows})}
  }, {isolationLevel: 'repeatable read', accessMode: 'read only'})
}
export function withEvidenceMetadata(retrieved: RetrievedChunk[], snapshot: DocumentSnapshot) {
  return retrieved.map(c => {
    const row = snapshot.chunks.find(p => p.id === c.id)
    if (!row || row.content !== c.content || row.pageNumber !== c.pageNumber || row.chunkIndex !== c.chunkIndex)
      throw new Error('Evidence changed during retrieval; retry the question')
    const metadata = row.metadata as Record<string, unknown> | null
    const string = (key: string) => typeof metadata?.[key] === 'string' ? metadata[key] as string : undefined
    const sourceUrl = string('sourceUrl')
    return {...c, documentId: snapshot.document.id, title: snapshot.document.title,
      sourceId: string('sourceId'), sectionTitle: string('sectionTitle'),
      ...(sourceUrl && /^https?:\/\//.test(sourceUrl) ? {sourceUrl} : {})}
  })
}
