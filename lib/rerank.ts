import type { RetrievedChunk } from './rag'
import { scorePassages, type ScoreResult } from './reranker-client'
import { validateRerankerConfig, type RerankerConfig } from './reranker-config'

export interface RerankedChunk extends RetrievedChunk { rerankerScore?: number; originalRank?: number }
export interface RerankerTrace {
  status: 'disabled' | 'empty' | 'reranked' | 'fallback'
  reason?: string
  candidates: number
  elapsed_ms: number
  inference?: Omit<ScoreResult, 'scores'>
}

export async function rerank(query: string, candidates: RetrievedChunk[], config: RerankerConfig,
  scorer = scorePassages): Promise<{ranked: RerankedChunk[]; trace: RerankerTrace}> {
  validateRerankerConfig(config)
  const start = performance.now()
  const trace: RerankerTrace = {status: 'disabled', candidates: candidates.length, elapsed_ms: 0}
  if (!config.enabled) return {ranked: candidates, trace}
  if (!candidates.length) return {ranked: [], trace: {...trace, status: 'empty'}}
  try {
    if (!query.trim() || query.length > 8000 || candidates.some(c =>
      !Number.isInteger(c.id) || c.id <= 0 || typeof c.content !== 'string' ||
      !c.content.trim() || c.content.length > 20000)) throw new Error('invalid_candidates')
    // Deduplicate by stable DB identity, retaining the first hybrid position.
    const unique = [...new Map(candidates.map(c => [c.id, candidates.find(x => x.id === c.id)!])).values()]
      .slice(0, config.candidates)
    const result = await scorer(query, unique.map(c => c.content), config)
    if (!Array.isArray(result.scores) || result.scores.length !== unique.length ||
      result.scores.some(s => typeof s !== 'number' || !Number.isFinite(s))) throw new Error('invalid_scores')
    const ranked = unique.map((c, i) => ({...c, rerankerScore: result.scores[i], originalRank: candidates.indexOf(c) + 1}))
      .sort((a, b) => b.rerankerScore - a.rerankerScore || a.originalRank - b.originalRank || a.id - b.id)
    const {scores: _scores, ...inference} = result
    void _scores
    return {ranked, trace: {status: 'reranked', candidates: unique.length, elapsed_ms: performance.now() - start, inference}}
  } catch (error) {
    const safe = ['invalid_candidates', 'invalid_scores', 'model_missing', 'worker_busy', 'timeout',
      'worker_unavailable', 'worker_exited', 'invalid_worker_response', 'worker_stopped']
    const reason = error instanceof Error && safe.includes(error.message) ? error.message : 'inference_failed'
    return {ranked: candidates, trace: {...trace, status: 'fallback', reason, elapsed_ms: performance.now() - start}}
  }
}
