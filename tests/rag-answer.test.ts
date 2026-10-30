import { expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('ai', () => ({ convertToModelMessages: vi.fn(), streamText: vi.fn() }))
import { convertToModelMessages, streamText } from 'ai'
import { startRagAnswer } from '@/lib/rag-answer'
import { CHAT_MODEL } from '@/lib/rag'

it('preserves the original chat prompt, model, converted messages and SDK defaults', async () => {
  const messages = [{ id: 'question', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Question?' }] }]
  const converted = [{ role: 'user' as const, content: 'Question?' }]
  vi.mocked(convertToModelMessages).mockResolvedValue(converted)
  await startRagAnswer(messages, [{id: 1, content: 'Evidence.', pageNumber: 3, chunkIndex: 2, vectorScore: 1, keywordScore: null, rrfScore: 1/61}], 'step5-v1')
  expect(convertToModelMessages).toHaveBeenCalledWith(messages)
  expect(streamText).toHaveBeenCalledWith({
    model: CHAT_MODEL,
    instructions: `You are a document assistant. Answer the user's question using ONLY the numbered context excerpts provided below. Rules:
- Cite every claim with the excerpt number in square brackets, e.g. [1] or [2][3].
- If the context does not contain the answer, say "I could not find this in the document." Do not invent information.
- Be concise and direct. Use the page numbers when helpful.\n\nContext excerpts:\n\n[1] (page 3)\nEvidence.`,
    messages: converted,
  })
})
