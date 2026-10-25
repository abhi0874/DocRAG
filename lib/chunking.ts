import { createHash } from 'node:crypto'
import defaults from './chunking-default.json'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

export interface TextChunk {
  content: string
  pageNumber: number
  chunkIndex: number
  metadata?: ChunkMetadata
}

export interface ChunkConfig { algorithm: 'legacy-v1' | 'heading-v1'; size: number; overlap: number }
export interface ChunkMetadata {
  sourceId: string
  sectionId: string
  sectionTitle: string | null
  headingDetection: 'heuristic' | 'none'
  contentHash: string
  configId: string
}
export const digest = (text: string) => createHash('sha256').update(text).digest('hex')
export function validateChunkConfig(value: ChunkConfig): ChunkConfig {
  if (!['legacy-v1', 'heading-v1'].includes(value.algorithm)
    || !Number.isInteger(value.size) || value.size < 256 || value.size > 4000
    || !Number.isInteger(value.overlap) || value.overlap < 0 || value.overlap >= value.size
    || (value.algorithm === 'legacy-v1' && (value.size !== 1000 || value.overlap !== 200))) {
    throw new Error('Invalid chunking configuration: size 256–4000, 0 <= overlap < size; legacy fixed at 1000/200')
  }
  return {algorithm: value.algorithm, size: value.size, overlap: value.overlap}
}
export function configId(config: ChunkConfig): string {
  const c = validateChunkConfig(config)
  return `${c.algorithm}-${c.size}-${c.overlap}`
}

/** Conservative textual signals; font size and PDF layout are not available. */
export function headingTitle(line: string): string | null {
  const clean = line.trim()
  if (!clean || clean.length > 120) return null
  const marked = clean.match(/^#{1,6}\s+(.+?)\s*#*$/)
    || clean.match(/^(.+?)\s*[¶#]$/)
    || clean.match(/^(\d+(?:\.\d+)*\.?)\s+([A-Z][^.!?;{}=]+)$/)
  if (marked) return clean.replace(/^#{1,6}\s+/, '').replace(/\s*[¶#]+$/, '').trim()
  if (/^[A-Z][A-Z\d &/–-]{2,79}$/.test(clean) && clean.split(/\s+/).length <= 10) return clean
  return null
}

/** Preserve line/paragraph boundaries; remove only unambiguous extraction artifacts. */
export function normalizePage(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n\n')
    .replace(/[\u00ad\u200b\u0000]/g, '').replace(/\u00a0/g, ' ')
    .split('\n').map(line => line.replace(/[^\S\n]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim()
}

function sections(text: string): {title: string | null; text: string}[] {
  const result: {title: string | null; text: string}[] = []
  let title: string | null = null
  let lines: string[] = []
  const flush = () => {const body = lines.join('\n').trim(); if (body) result.push({title, text: body})}
  for (const line of text.split('\n')) {
    const detected = headingTitle(line)
    if (detected) {flush(); title = detected; lines = [line]}
    else lines.push(line)
  }
  flush()
  return result
}

function splitSection(text: string, config: ChunkConfig): string[] {
  const output: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + config.size, text.length)
    if (end < text.length) {
      // Keep at least half a window; prefer paragraphs, then sentences/lines/words.
      const floor = start + Math.floor(config.size / 2)
      const window = text.slice(floor, end)
      const paragraph = window.lastIndexOf('\n\n')
      const sentence = [...window.matchAll(/[.!?](?=\s)/g)].at(-1)?.index
      const line = window.lastIndexOf('\n')
      const word = window.lastIndexOf(' ')
      if (paragraph >= 0) end = floor + paragraph + 2
      else if (sentence !== undefined) end = floor + sentence + 1
      else if (line >= 0) end = floor + line + 1
      else if (word >= 0) end = floor + word + 1
      // Do not cut a UTF-16 surrogate pair even for a long unbroken word.
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--
    }
    const content = text.slice(start, end).trim()
    if (content) output.push(content)
    if (end >= text.length) break
    // Requested overlap is a maximum. Guarantee progress even for extreme settings.
    let next = Math.max(start + 1, end - config.overlap)
    if (next > end) next = end
    // Start at a word boundary when available, without dropping unseen text.
    if (next < end && next > 0 && /\S/.test(text[next - 1])) {
      const boundary = text.slice(next, end).search(/\s/)
      next = boundary >= 0 ? next + boundary + 1 : next
    }
    if (/[\uDC00-\uDFFF]/.test(text[next])) next++
    start = Math.min(next, end)
  }
  return output
}

export function chunkPages(pages: string[], config: ChunkConfig = defaults as ChunkConfig,
  sourceIds?: string[]): TextChunk[] {
  const c = validateChunkConfig(config)
  if (sourceIds && (sourceIds.length !== pages.length || sourceIds.some(id => !id.trim())
    || new Set(sourceIds).size !== sourceIds.length)) throw new Error('Invalid page source identifiers')
  if (c.algorithm === 'legacy-v1') return legacyChunkPages(pages)
  const chunks: TextChunk[] = []
  pages.forEach((page, pageIndex) => {
    const sourceId = sourceIds?.[pageIndex] ?? `page:${pageIndex + 1}`
    sections(normalizePage(page)).forEach((section, sectionIndex) => {
      for (const content of splitSection(section.text, c)) {
        chunks.push({content, pageNumber: pageIndex + 1, chunkIndex: chunks.length,
          metadata: {sourceId, sectionId: `${sourceId}:section:${sectionIndex}`,
            sectionTitle: section.title, headingDetection: section.title ? 'heuristic' : 'none',
            contentHash: digest(content), configId: configId(c)}})
      }
    })
  })
  return chunks
}

/**
 * Split page texts into overlapping chunks, preferring sentence boundaries.
 * Overlap preserves context that would otherwise be lost at chunk edges.
 */
export function legacyChunkPages(pages: string[]): TextChunk[] {
  const chunks: TextChunk[] = []
  let chunkIndex = 0

  pages.forEach((pageText, pageIdx) => {
    const text = pageText.replace(/\s+/g, ' ').trim()
    if (!text) return

    let start = 0
    while (start < text.length) {
      let end = Math.min(start + CHUNK_SIZE, text.length)

      // Prefer breaking at a sentence boundary within the last 200 chars
      if (end < text.length) {
        const window = text.slice(Math.max(start, end - 200), end)
        const lastPeriod = window.lastIndexOf('. ')
        if (lastPeriod > 0) {
          end = Math.max(start, end - 200) + lastPeriod + 1
        }
      }

      const content = text.slice(start, end).trim()
      if (content.length > 20) {
        chunks.push({ content, pageNumber: pageIdx + 1, chunkIndex })
        chunkIndex++
      }

      if (end >= text.length) break
      start = end - CHUNK_OVERLAP
    }
  })

  return chunks
}

