import selected from './retrieval-default.json'
export interface RetrievalConfig {
  mode: 'hybrid' | 'vector' | 'keyword'
  execution: 'parallel' | 'combined'
  vectorCandidates: number
  keywordCandidates: number
  rrfK: number
  keywordMode: 'and' | 'or'
  tieBreak: 'legacy' | 'id'
}
export const retrievalDefault = selected as RetrievalConfig
export function validateRetrieval(config: RetrievalConfig) {
  if (!['hybrid', 'vector', 'keyword'].includes(config.mode)
    || !['parallel', 'combined'].includes(config.execution)
    || !['and', 'or'].includes(config.keywordMode) || !['legacy', 'id'].includes(config.tieBreak)
    || ![config.vectorCandidates, config.keywordCandidates].every(n => Number.isInteger(n) && n >= 1 && n <= 100)
    || !Number.isInteger(config.rrfK) || config.rrfK < 1 || config.rrfK > 1000) throw new Error('Invalid retrieval configuration')
  return config
}
export interface RetrievalTiming {
  embedding_ms: number; vector_ms: number | null; keyword_ms: number | null; database_wall_ms: number
  fusion_ms: number; total_ms: number; vector_count: number; keyword_count: number
  combined_ms: number | null
}
