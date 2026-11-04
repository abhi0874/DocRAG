import { performance } from 'node:perf_hooks'
import { sql } from 'drizzle-orm'
import { db } from './db'
import {documentScope} from './security/access'
import { fuseRanks, type SearchRow } from './rank-fusion'
import { validateRetrieval, type RetrievalConfig, type RetrievalTiming } from './retrieval-config'

export function searchStatements(query: string, documentId: number, embedding: number[], config: RetrievalConfig, userId:string|null=null) {
  validateRetrieval(config)
  const vector = `[${embedding.join(',')}]`
  const tsquery = config.keywordMode === 'and'
    ? sql`plainto_tsquery('english', ${query})`
    : sql`to_tsquery('english', replace(plainto_tsquery('english', ${query})::text, ' & ', ' | '))`
  const tie = config.tieBreak === 'id' ? sql`, id ASC` : sql``
  const vectorSql = sql`SELECT id, content, page_number, chunk_index,
    1 - (embedding <=> ${vector}::vector) AS score FROM chunks
    WHERE document_id = ${documentId} AND ${documentScope(sql`chunks.document_id`,userId)} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vector}::vector ${tie} LIMIT ${config.vectorCandidates}`
  const keywordSql = sql`SELECT id, content, page_number, chunk_index,
    ts_rank(content_tsv, ${tsquery}) AS score FROM chunks
    WHERE document_id = ${documentId} AND ${documentScope(sql`chunks.document_id`,userId)} AND content_tsv @@ ${tsquery}
    ORDER BY score DESC ${tie} LIMIT ${config.keywordCandidates}`
  const combined = sql`WITH vectors AS MATERIALIZED (${vectorSql}), keywords AS MATERIALIZED (${keywordSql})
    SELECT 'vector' AS kind, * FROM vectors UNION ALL SELECT 'keyword' AS kind, * FROM keywords`
  return {vectorSql, keywordSql, combined}
}

export async function retrieve(query: string, documentId: number, topK: number, config: RetrievalConfig,
  embedQuery: () => Promise<number[]>, observer?: (timing: RetrievalTiming) => void, userId:string|null=null) {
  validateRetrieval(config)
  if (typeof query !== 'string' || query.length > 8000 || !Number.isInteger(documentId) || documentId < 1
    || !Number.isInteger(topK) || topK < 1 || topK > 50) throw new Error('Invalid retrieval request')
  const started = performance.now()
  const timing: RetrievalTiming = {embedding_ms: 0, vector_ms: 0, keyword_ms: 0, database_wall_ms: 0,
    fusion_ms: 0, total_ms: 0, vector_count: 0, keyword_count: 0, combined_ms: null}
  if (!query.trim()) {observer?.(timing); return []}
  let embedding: number[] = []
  if (config.mode !== 'keyword') {
    const t = performance.now(); embedding = await embedQuery(); timing.embedding_ms = performance.now() - t
  }
  const statements = searchStatements(query, documentId, embedding, config, userId)
  let vector: SearchRow[] = [], keyword: SearchRow[] = []
  const databaseStart = performance.now()
  if (config.execution === 'combined' && config.mode === 'hybrid') {
    const rows = (await db.execute(statements.combined)).rows as unknown as SearchRow[]
    timing.combined_ms = performance.now() - databaseStart
    timing.vector_ms = null; timing.keyword_ms = null
    vector = rows.filter(r => r.kind === 'vector'); keyword = rows.filter(r => r.kind === 'keyword')
    // UNION ALL output order is not a ranking contract. Re-establish each list's score/id order.
    const order = (a: SearchRow, b: SearchRow) => Number(b.score) - Number(a.score) || a.id - b.id
    vector.sort(order); keyword.sort(order)
  } else {
    await Promise.all([
      (async () => {if (config.mode === 'keyword') return; const t = performance.now();
        vector = (await db.execute(statements.vectorSql)).rows as unknown as SearchRow[]; timing.vector_ms = performance.now() - t})(),
      (async () => {if (config.mode === 'vector') return; const t = performance.now();
        keyword = (await db.execute(statements.keywordSql)).rows as unknown as SearchRow[]; timing.keyword_ms = performance.now() - t})(),
    ])
  }
  timing.database_wall_ms = performance.now() - databaseStart
  timing.vector_count = vector.length; timing.keyword_count = keyword.length
  const fuseStart = performance.now()
  const result = fuseRanks(vector, keyword, config.rrfK, topK, config.tieBreak === 'id')
  timing.fusion_ms = performance.now() - fuseStart; timing.total_ms = performance.now() - started
  observer?.(timing)
  return result
}
