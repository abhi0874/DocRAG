import { expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('ai', () => ({ convertToModelMessages: vi.fn(), streamText: vi.fn() }))
import { convertToModelMessages, streamText } from 'ai'
import { startRagAnswer, partialEvidenceInstructions } from '@/lib/rag-answer'
import { CHAT_MODEL } from '@/lib/rag'

it('preserves the frozen prompt, model and SDK defaults while clarifying partial support', async () => {
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
- Be concise and direct. Use the page numbers when helpful.\n\nContext excerpts:\n\n[1] (page 3)\nEvidence.\n\n${partialEvidenceInstructions}`,
    messages: converted,
  })
})
it('keeps exact source text and distinguishes partial answers from unsupported knowledge',async()=>{
 const source={id:158,content:'There is no matching entry in the cities table for Hayward,\nso the join ignores unmatched rows.',pageNumber:6,chunkIndex:56,vectorScore:1,keywordScore:null,rrfScore:1/61}
 await startRagAnswer([{id:'q',role:'user',parts:[{type:'text',text:'Why are rows omitted, and what constraint prevents unknown references?'}]}],[source],'step5-v1')
 const options=vi.mocked(streamText).mock.calls.at(-1)![0]
 expect(options.instructions).toContain(source.content)
 expect(options.instructions).toContain('Answer only the supported parts.')
 expect(options.instructions).toContain('do not first supply a plausible answer from memory')
 expect(options.instructions).toContain('Do not attach citations to statements about missing evidence')
 expect(options.instructions).not.toContain('foreign key')
})
