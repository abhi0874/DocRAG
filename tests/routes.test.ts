import { expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: { insert: vi.fn(), delete: vi.fn() } }))
vi.mock('@/lib/rag', () => ({ chunkPages: vi.fn(), embedChunks: vi.fn(), hybridSearch: vi.fn(), buildContext: vi.fn(), CHAT_MODEL: {}, RAG_INSTRUCTIONS: '' }))
vi.mock('unpdf', () => ({ getDocumentProxy: vi.fn(), extractText: vi.fn() }))
import { POST as upload } from '@/app/api/documents/route'
import { POST as chat } from '@/app/api/chat/route'
import { POST as evaluate } from '@/app/api/evaluations/route'
import { DELETE as remove } from '@/app/api/documents/[id]/route'
import { db } from '@/lib/db'
import { chunkPages } from '@/lib/rag'
import { extractText, getDocumentProxy } from 'unpdf'

it('rejects an upload without a file', async () => {
  const response = await upload(new Request('http://localhost/api/documents', { method: 'POST', body: new FormData() }))
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'No file provided' })
})
it('rejects non-PDF files before accessing the database', async () => {
  const body = new FormData()
  body.set('file', new File(['Public text'], 'document.txt'))
  expect((await upload(new Request('http://localhost/api/documents', { method: 'POST', body }))).status).toBe(400)
  expect(db.insert).not.toHaveBeenCalled()
})
it('rejects a PDF with no extractable text', async () => {
  vi.mocked(getDocumentProxy).mockResolvedValue({} as Awaited<ReturnType<typeof getDocumentProxy>>)
  vi.mocked(extractText).mockResolvedValue({ text: [], totalPages: 1 } as never)
  vi.mocked(chunkPages).mockReturnValue([])
  const body = new FormData()
  body.set('file', new File(['mock PDF'], 'public.pdf'))
  const response = await upload(new Request('http://localhost/api/documents', { method: 'POST', body }))
  expect(response.status).toBe(400)
  expect((await response.json()).error).toContain('No extractable text')
  expect(db.insert).not.toHaveBeenCalled()
})
it('requires a selected document for chat', async () => {
  const response = await chat(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({messages: []}) }))
  expect(response.status).toBe(400)
})
it('requires a question for comparisons', async () => {
  const response = await evaluate(new Request('http://localhost/api/evaluations', { method: 'POST', body: JSON.stringify({documentId: 1, question: ' '}) }))
  expect(response.status).toBe(400)
})
it('rejects a noninteger deletion id before database access', async () => {
  const response = await remove(new Request('http://localhost'), {params: Promise.resolve({id: 'abc'})})
  expect(response.status).toBe(400)
  expect(db.delete).not.toHaveBeenCalled()
})
