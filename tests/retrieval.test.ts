import {expect, it, vi} from 'vitest'
vi.mock('../lib/db', () => ({db: {execute: vi.fn()}}))
import {db} from '../lib/db'
import {PgDialect} from 'drizzle-orm/pg-core'
import {fuseRanks, type SearchRow} from '../lib/rank-fusion'
import {retrieve, searchStatements} from '../lib/retrieval'
import {retrievalDefault, validateRetrieval} from '../lib/retrieval-config'
const row = (id: number, score = .5): SearchRow => ({id, score, content: `Evidence ${id}`, page_number: 2, chunk_index: id})
it('computes hand-checked RRF scores and merges overlapping IDs once', () => {
  const result = fuseRanks([row(2), row(1)], [row(1), row(3)], 60, 10, true)
  expect(result.map(r => r.id)).toEqual([1, 2, 3])
  expect(result[0].rrfScore).toBe(1/62 + 1/61)
  expect(result[0]).toMatchObject({pageNumber: 2, chunkIndex: 1, content: 'Evidence 1', vectorScore: .5, keywordScore: .5})
  expect(fuseRanks([row(1), row(1)], [], 60, 10, true)).toHaveLength(1)
})
it('resolves equal fused scores by ID while retaining the historical control option', () => {
  const a = [row(2), row(1)], b = [row(1), row(2)]
  expect(fuseRanks(a, b, 60, 10, true).map(r => r.id)).toEqual([1, 2])
  expect(fuseRanks(a, b, 60, 10, false).map(r => r.id)).toEqual([2, 1])
  expect(fuseRanks([], [], 60, 10, true)).toEqual([])
})
it('parameterizes technical terms, punctuation and hostile strings with document filters', () => {
  for (const query of ['PostgreSQL', 'pgvector', 'FastAPI GET /items/{id}', "'); DROP TABLE chunks; --", 'a & b | ! c']) {
    const statements = searchStatements(query, 42, [0, 1], {...retrievalDefault, tieBreak: 'id', keywordMode: 'or'})
    for (const statement of [statements.keywordSql, statements.combined]) {
      const built = new PgDialect().sqlToQuery(statement)
      expect(built.sql).not.toContain(query)
      expect(built.params).toContain(query)
      expect(built.params).toContain(42)
      expect(built.sql).toContain('document_id = $')
      expect(built.sql).toContain('id ASC')
    }
  }
})
it('avoids model and database calls for empty input and rejects invalid requests', async () => {
  const embed = vi.fn(); vi.mocked(db.execute).mockClear()
  expect(await retrieve('  ', 3, 6, retrievalDefault, embed)).toEqual([])
  expect(embed).not.toHaveBeenCalled(); expect(db.execute).not.toHaveBeenCalled()
  for (const [query, id, k] of [[null, 3, 6], ['test', -1, 6], ['test', 3, 0]] as const) {
    await expect(retrieve(query as string, id, k, retrievalDefault, embed)).rejects.toThrow('Invalid retrieval request')
  }
  expect(() => validateRetrieval({...retrievalDefault, vectorCandidates: 0})).toThrow()
})
it('runs keyword-only without embeddings and preserves ranked source metadata', async () => {
  const embed = vi.fn()
  vi.mocked(db.execute).mockResolvedValueOnce({rows: [row(2, .9), row(1, .2)]} as never)
  const result = await retrieve('HTTP POST', 3, 6, {...retrievalDefault, mode: 'keyword'}, embed)
  expect(embed).not.toHaveBeenCalled()
  expect(result.map(r => r.id)).toEqual([2, 1]); expect(result[0].vectorScore).toBeNull()
})
it('runs vector-only and restores each combined list order before fusion', async () => {
  vi.mocked(db.execute).mockResolvedValueOnce({rows: [row(2, .9), row(1, .2)]} as never)
  expect((await retrieve('meaning', 3, 6, {...retrievalDefault, mode: 'vector'}, async () => [0, 1])).map(r => r.id)).toEqual([2, 1])
  vi.mocked(db.execute).mockResolvedValueOnce({rows: [{...row(1, .2), kind: 'vector'}, {...row(2, .9), kind: 'vector'}, {...row(1, .8), kind: 'keyword'}]} as never)
  const observe = vi.fn()
  const result = await retrieve('meaning', 3, 6, {...retrievalDefault, execution: 'combined', tieBreak: 'id'}, async () => [0, 1], observe)
  expect(result.map(r => r.id)).toEqual([1, 2])
  expect(observe.mock.calls[0][0]).toMatchObject({vector_count: 2, keyword_count: 1})
})
