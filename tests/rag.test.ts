import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: { execute: vi.fn() } }))
vi.mock('ai', () => ({ embed: vi.fn(), embedMany: vi.fn() }))
import { embed, embedMany } from 'ai'
import { db } from '@/lib/db'
import { legacyChunkPages as chunkPages } from '@/lib/chunking'
import { buildContext, embedChunks, hybridSearch } from '@/lib/rag'

describe('existing chunking behavior', () => {
  it('returns no chunks for empty or whitespace-only documents', () => {
    expect(chunkPages([])).toEqual([])
    expect(chunkPages([' ', '\n\t'])).toEqual([])
  })
  it('normalizes whitespace while retaining page numbers and consecutive indexes', () => {
    expect(chunkPages(['', 'A public   document contains\nuseful information.', 'Another public document explains the details.']))
      .toEqual([
        { content: 'A public document contains useful information.', pageNumber: 2, chunkIndex: 0 },
        { content: 'Another public document explains the details.', pageNumber: 3, chunkIndex: 1 },
      ])
  })
  it('preserves overlap and all content on long pages', () => {
    const text = 'abcdefghij'.repeat(250)
    const chunks = chunkPages([text])
    expect(chunks.map(c => c.content.length)).toEqual([1000, 1000, 900])
    expect(chunks[0].content.slice(-200)).toBe(chunks[1].content.slice(0, 200))
    expect(chunks[0].content + chunks.slice(1).map(c => c.content.slice(200)).join('')).toBe(text)
  })
  it('prefers a sentence boundary near the chunk end', () => {
    const chunks = chunkPages(['a'.repeat(850) + '. ' + 'b'.repeat(500)])
    expect(chunks[0].content).toBe('a'.repeat(850) + '.')
  })
})

it('formats numbered citations with the original page number', () => {
  expect(buildContext([])).toBe('')
  expect(buildContext([{id: 3, content: 'Public documentation', pageNumber: 7, chunkIndex: 0, vectorScore: 1, keywordScore: null, rrfScore: 1/61}]))
    .toBe('[1] (page 7)\nPublic documentation')
})

it('does not call the embedding service for an empty list', async () => {
  vi.mocked(embedMany).mockClear()
  expect(await embedChunks([])).toEqual([])
  expect(embedMany).not.toHaveBeenCalled()
})

it('fuses duplicate results and ranks shared hits first', async () => {
  vi.mocked(embed).mockResolvedValue({ embedding: [0, 1] } as Awaited<ReturnType<typeof embed>>)
  const row = (id: number) => ({id, content: `Document ${id}`, page_number: 1, chunk_index: id, score: '0.5'})
  vi.mocked(db.execute)
    .mockResolvedValueOnce({ rows: [row(1), row(2)], command: 'SELECT', rowCount: 2, oid: 0, fields: [] })
    .mockResolvedValueOnce({ rows: [row(2), row(3)], command: 'SELECT', rowCount: 2, oid: 0, fields: [] })
  const results = await hybridSearch('documentation', 1, 2)
  expect(results.map(r => r.id)).toEqual([2, 1])
  expect(results[0].rrfScore).toBeCloseTo(1/62 + 1/61)
  expect(results[0].keywordScore).toBe(0.5)
})
