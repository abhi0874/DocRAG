import { describe, expect, it } from 'vitest'
import { chunkPages, configId, digest, headingTitle, legacyChunkPages, normalizePage, validateChunkConfig } from '../lib/chunking'

const config = {algorithm: 'heading-v1' as const, size: 500, overlap: 100}
describe('heading-aware chunks', () => {
  it('detects textual heading signals without treating prose or code as headings', () => {
    for (const heading of ['# Introduction', '1.2. Getting Started', 'DATA TYPES', 'Data conversion¶']) expect(headingTitle(heading)).not.toBeNull()
    for (const line of ['An ordinary sentence.', 'return {value: 3}', 'CREATE TABLE products (', '']) expect(headingTitle(line)).toBeNull()
  })
  it('retains short sections, order and accurate page/source metadata', () => {
    const result = chunkPages(['', '# Alpha\nYes.\n# Beta\nNo.'], config, ['doc:1', 'doc:2'])
    expect(result.map(c => c.content)).toEqual(['# Alpha\nYes.', '# Beta\nNo.'])
    expect(result.map(c => c.chunkIndex)).toEqual([0, 1])
    expect(result.every(c => c.pageNumber === 2 && c.metadata?.sourceId === 'doc:2')).toBe(true)
    expect(result.map(c => c.metadata?.sectionTitle)).toEqual(['Alpha', 'Beta'])
    expect(result[1].metadata?.sectionId).toBe('doc:2:section:1')
    for (const chunk of result) expect(chunk.metadata?.contentHash).toBe(digest(chunk.content))
  })
  it('preserves paragraph and sentence boundaries when they fit', () => {
    const paragraph = 'a'.repeat(300) + '\n\n' + 'b'.repeat(300)
    expect(chunkPages([paragraph], config)[0].content).toBe('a'.repeat(300))
    const sentence = 'a'.repeat(350) + '. ' + 'b'.repeat(300)
    expect(chunkPages([sentence], config)[0].content).toBe('a'.repeat(350) + '.')
  })
  it('handles long unbroken text with exact overlap, bounded size and full coverage', () => {
    const text = 'abcdefghij'.repeat(200)
    const result = chunkPages([text], config)
    expect(result.every(c => c.content.length <= 500)).toBe(true)
    expect(result[0].content.slice(-100)).toBe(result[1].content.slice(0, 100))
    expect(result[0].content + result.slice(1).map(c => c.content.slice(100)).join('')).toBe(text)
    expect(result.every(c => c.metadata?.sectionTitle === null)).toBe(true)
  })
  it('handles empty, tiny, unstructured and Unicode PDF text deterministically', () => {
    expect(chunkPages(['', '\n \t'], config)).toEqual([])
    expect(chunkPages(['Hi'], config)[0].content).toBe('Hi')
    expect(normalizePage(' A\t B\r\n\r\nco\u00adoperate\fC\u00a0D\u200b')).toBe('A B\n\ncooperate\n\nC D')
    const input = ['Plain prose. '.repeat(100), '😀'.repeat(800)]
    const output = chunkPages(input, config)
    expect(chunkPages(input, config)).toEqual(output)
    expect(output.every(c => c.content.length <= 500 && c.content.isWellFormed())).toBe(true)
  })
  it('validates settings and source mappings; preserves the exact legacy control', () => {
    for (const invalid of [{size: 0}, {size: 10000}, {size: 2.5}, {overlap: -1}, {overlap: 500}, {algorithm: 'unknown'}]) {
      expect(() => validateChunkConfig({...config, ...invalid} as typeof config)).toThrow()
    }
    expect(() => chunkPages(['A', 'B'], config, ['same', 'same'])).toThrow()
    expect(configId(config)).toBe('heading-v1-500-100')
    const input = ['A public page. '.repeat(200)]
    expect(chunkPages(input, {algorithm: 'legacy-v1', size: 1000, overlap: 200})).toEqual(legacyChunkPages(input))
    expect(chunkPages(input, {...config, overlap: 0}).length).toBeGreaterThan(0)
  })
})

 it('uses the measured selected configuration for future uploads', () => {
  const text = '# Overview\n' + 'Public evidence sentence. '.repeat(100)
  expect(chunkPages([text])).toEqual(chunkPages([text], {algorithm: 'heading-v1', size: 1400, overlap: 280}))
  expect(chunkPages([text])[0].metadata?.configId).toBe('heading-v1-1400-280')
})
