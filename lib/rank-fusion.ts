import type { RetrievedChunk } from './rag'
export interface SearchRow { id: number; content: string; page_number: number; chunk_index: number; score: string | number; kind?: string }
export function fuseRanks(vector: SearchRow[], keyword: SearchRow[], k: number, topK: number, stable: boolean): RetrievedChunk[] {
  const fused = new Map<number, RetrievedChunk>()
  for (const [rows, kind] of [[vector, 'vectorScore'], [keyword, 'keywordScore']] as const) {
    const seen = new Set<number>()
    rows.forEach((row, rank) => {
      if (seen.has(row.id)) return
      seen.add(row.id)
      let chunk = fused.get(row.id)
      if (!chunk) {
        chunk = {id: row.id, content: row.content, pageNumber: row.page_number, chunkIndex: row.chunk_index,
          vectorScore: null, keywordScore: null, rrfScore: 0}
        fused.set(row.id, chunk)
      }
      chunk[kind] = Number(row.score)
      chunk.rrfScore += 1 / (k + rank + 1)
    })
  }
  return [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore || (stable ? a.id - b.id : 0)).slice(0, topK)
}
