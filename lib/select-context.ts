import { hybridSearch } from './rag'
import { rerank } from './rerank'
import { rerankerConfig, validateRerankerConfig, type RerankerConfig } from './reranker-config'
import { retrievalDefault, type RetrievalConfig, type RetrievalTiming } from './retrieval-config'

/** Same selection path for chat, comparison UI and local evaluation. */
export async function selectContext(query: string, documentId: number, topK = 6,
  config: RerankerConfig = rerankerConfig(), retrieval: RetrievalConfig = retrievalDefault,
  observer?: (timing: RetrievalTiming) => void) {
  validateRerankerConfig(config)
  const start = performance.now()
  const candidates = await hybridSearch(query, documentId, config.enabled ? Math.max(topK, config.candidates) : topK, retrieval, observer)
  const hybridMs = performance.now() - start
  const result = await rerank(query, candidates, config)
  return {...result, ranked: result.ranked.slice(0, topK), candidates,
    hybrid_ms: hybridMs, selection_ms: performance.now() - start}
}
