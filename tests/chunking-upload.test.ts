import { expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: {insert: vi.fn(), update: vi.fn()} }))
vi.mock('@/lib/rag', () => ({chunkPages: vi.fn(), embedChunks: vi.fn()}))
vi.mock('unpdf', () => ({getDocumentProxy: vi.fn(), extractText: vi.fn()}))
import { db } from '@/lib/db'
import { chunkPages as realChunks } from '@/lib/chunking'
import { chunkPages, embedChunks } from '@/lib/rag'
import { extractText, getDocumentProxy } from 'unpdf'
import { POST } from '@/app/api/documents/route'

it('persists actual PDF page, document, source and section metadata with corresponding vectors', async () => {
  vi.mocked(getDocumentProxy).mockResolvedValue({} as never)
  vi.mocked(extractText).mockResolvedValue({text: ['', '# Overview\nPublic evidence.'], totalPages: 2} as never)
  const pieces = realChunks(['', '# Overview\nPublic evidence.'], {algorithm: 'heading-v1', size: 1400, overlap: 280})
  vi.mocked(chunkPages).mockReturnValue(pieces)
  vi.mocked(embedChunks).mockResolvedValue([[0.1, 0.2]])
  const inserted = vi.fn().mockResolvedValue(undefined)
  vi.mocked(db.insert).mockReturnValueOnce({values: () => ({returning: async () => [{id: 42}]})} as never)
    .mockReturnValueOnce({values: inserted} as never)
  vi.mocked(db.update).mockReturnValue({set: () => ({where: () => ({returning: async () => [{id: 42, status: 'ready'}]})})} as never)
  const body = new FormData()
  body.set('file', new File(['mock public PDF'], 'guide.pdf'))
  const response = await POST(new Request('http://localhost/api/documents', {method: 'POST', body}))
  expect(response.status).toBe(200)
  expect(inserted).toHaveBeenCalledWith([expect.objectContaining({documentId: 42, pageNumber: 2, chunkIndex: 0, embedding: [0.1, 0.2],
    metadata: expect.objectContaining({documentId: 42, sourceDocument: 'guide.pdf', sourceId: 'document:42:page:2',
      sectionId: 'document:42:page:2:section:0', sectionTitle: 'Overview', configId: 'heading-v1-1400-280'})})])
})
