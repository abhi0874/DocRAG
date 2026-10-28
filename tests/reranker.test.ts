import { describe, expect, it, vi } from 'vitest'
import { rerank } from '../lib/rerank'
import { rerankerConfig, validateRerankerConfig } from '../lib/reranker-config'
import type { ScoreResult } from '../lib/reranker-client'

const config = {...rerankerConfig(), enabled: true}
const chunks = [1, 2, 3].map(id => ({id, content: `passage ${id}`, pageNumber: 2,
  chunkIndex: id, vectorScore: 0.9, keywordScore: null, rrfScore: 1 / (60 + id)}))
const scorer = (scores: number[]) => vi.fn(async () => ({scores, device: 'cpu', inference_ms: 1,
  initialization_ms: 0, truncated: 0, peak_rss_bytes: 123, mps_allocated_bytes: null} satisfies ScoreResult))

describe('optional reranking', () => {
  it('does not invoke inference or alter disabled results', async () => {
    const score = scorer([1, 2, 3])
    const result = await rerank('query', chunks, {...config, enabled: false}, score)
    expect(result.ranked).toBe(chunks); expect(score).not.toHaveBeenCalled()
    expect(result.trace.status).toBe('disabled')
  })
  it('sorts by score with original-rank ties and retains all citation metadata', async () => {
    const result = await rerank('query', chunks, config, scorer([1, 2, 2]))
    expect(result.ranked.map(c => c.id)).toEqual([2, 3, 1])
    expect(result.ranked[0]).toEqual({...chunks[1], rerankerScore: 2, originalRank: 2})
    expect(result.trace.status).toBe('reranked')
  })
  it('deduplicates before inference and does not invent source identities', async () => {
    const score = scorer([3, 2, 1])
    const result = await rerank('query', [...chunks, chunks[0]], config, score)
    expect(score.mock.calls[0]).toBeDefined()
    expect(result.ranked.map(c => c.id)).toEqual([1, 2, 3])
  })
  it('does not start a model for empty results', async () => {
    const score = scorer([])
    expect((await rerank('query', [], config, score)).trace.status).toBe('empty')
    expect(score).not.toHaveBeenCalled()
  })
  it.each([[1], [1, NaN, 2], [1, Infinity, 2], undefined])('falls back on invalid scores %j', async scores => {
    const result = await rerank('query', chunks, config, scorer(scores as number[]))
    expect(result.ranked).toBe(chunks); expect(result.trace.reason).toBe('invalid_scores')
  })
  it.each(['model_missing', 'timeout', 'worker_exited', 'worker_unavailable', 'worker_busy', 'initialization_failed'])
    ('falls back honestly on %s', async reason => {
      const result = await rerank('query', chunks, config, async () => {throw new Error(reason)})
      expect(result.ranked).toBe(chunks); expect(result.trace.status).toBe('fallback')
    })
  it('rejects invalid passage content before inference', async () => {
    const score = scorer([1])
    expect((await rerank('query', [{...chunks[0], content: ''}], config, score)).trace.reason).toBe('invalid_candidates')
    expect(score).not.toHaveBeenCalled()
  })
  it('limits inference to the declared pool', async () => {
    const many = Array.from({length: 24}, (_, i) => ({...chunks[0], id: i + 1}))
    expect((await rerank('query', many, config, scorer(Array(10).fill(1)))).ranked).toHaveLength(10)
  })
  it.each([{candidates: 21}, {device: 'cuda'}, {timeoutMs: 0}, {revision: 'latest'}, {enabled: 'true'}])
    ('rejects invalid configuration %j', patch => {
      expect(() => validateRerankerConfig({...config, ...patch} as never)).toThrow('Invalid')
    })
})
