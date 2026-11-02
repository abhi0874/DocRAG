import { expect, it, vi } from 'vitest'
vi.mock('@/lib/select-context', () => ({selectContext: vi.fn()}))
vi.mock('@/lib/evidence', () => ({documentSnapshot: vi.fn(async () => ({hash: 'test'})), withEvidenceMetadata: (r: unknown) => r}))
vi.mock('@/lib/public-cache-policy', () => ({publicCacheScope: () => null}))
vi.mock('@/lib/rag-answer', () => ({startRagAnswer: vi.fn()}))
vi.mock('ai', () => ({
  createUIMessageStream: vi.fn(({execute}) => {void execute({writer: {write: vi.fn(), merge: vi.fn()}}); return new ReadableStream({start(c) {c.close()}})}),
  createUIMessageStreamResponse: vi.fn(({headers}) => new Response(new ReadableStream({start(c) {c.close()}}), {headers})),
  toUIMessageStream: vi.fn(() => new ReadableStream()),
}))
import { POST } from '@/app/api/chat/route'
import { selectContext } from '@/lib/select-context'
import { startRagAnswer } from '@/lib/rag-answer'

it.each(['reranked', 'fallback', 'disabled'] as const)('chat uses selected evidence and exposes %s', async status => {
  const ranked = [{id: 7, content: 'Selected evidence', pageNumber: 3, chunkIndex: 4,
    vectorScore: 0.8, keywordScore: null, rrfScore: .02}]
  vi.mocked(selectContext).mockResolvedValue({ranked, candidates: ranked, hybrid_ms: 1,
    selection_ms: 2, trace: {status, candidates: 1, elapsed_ms: 1, ...(status === 'fallback' ? {reason: 'timeout'} : {})}})
  vi.mocked(startRagAnswer).mockResolvedValue({stream: new ReadableStream()} as never)
  const messages = [{id: 'm', role: 'user', parts: [{type: 'text', text: 'question'}]}]
  const response = await POST(new Request('http://localhost/api/chat', {method: 'POST',
    body: JSON.stringify({documentId: 42, messages})}))
  expect(selectContext).toHaveBeenLastCalledWith('question', 42, 6)
  expect(startRagAnswer).toHaveBeenLastCalledWith(messages, ranked, 'step5-v1', expect.any(AbortSignal))
  expect(response.headers.get('X-DocRAG-Reranker-Status')).toBe(status)
  if (status === 'fallback') expect(response.headers.get('X-DocRAG-Reranker-Reason')).toBe('timeout')
})
