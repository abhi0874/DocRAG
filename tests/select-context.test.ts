import { expect, it, vi } from 'vitest'
vi.mock('../lib/rag', () => ({hybridSearch: vi.fn()}))
vi.mock('../lib/reranker-client', () => ({scorePassages: vi.fn()}))
import { hybridSearch } from '../lib/rag'
import { scorePassages } from '../lib/reranker-client'
import { selectContext } from '../lib/select-context'
import { rerankerConfig } from '../lib/reranker-config'

it('keeps document filtering in hybrid search and preserves disabled topK', async () => {
  vi.mocked(hybridSearch).mockResolvedValue([])
  await selectContext('question', 42, 6, {...rerankerConfig(), enabled: false})
  expect(hybridSearch).toHaveBeenLastCalledWith('question', 42, 6, expect.any(Object), undefined)
})
it('retrieves the requested valid pool and selects top6 from scored sources', async () => {
  const chunks = Array.from({length: 12}, (_, i) => ({id: i + 1, content: `p${i}`, pageNumber: 1,
    chunkIndex: i, vectorScore: 0.5, keywordScore: null, rrfScore: 1 / (61 + i)}))
  vi.mocked(hybridSearch).mockResolvedValue(chunks)
  vi.mocked(scorePassages).mockResolvedValue({scores: chunks.map(c => c.id), device: 'cpu',
    inference_ms: 1, initialization_ms: 0, truncated: 0, peak_rss_bytes: 1, mps_allocated_bytes: null})
  const result = await selectContext('question', 42, 6, {...rerankerConfig(), enabled: true, candidates: 20})
  expect(hybridSearch).toHaveBeenLastCalledWith('question', 42, 20, expect.any(Object), undefined)
  expect(result.ranked.map(c => c.id)).toEqual([12, 11, 10, 9, 8, 7])
  expect(result.trace.candidates).toBe(12)
})
