// Diagnostic candidates only. Both consume excerpts already authorized by the caller.
import type { RetrievedChunk } from '../../lib/rag'

function trigrams(text: string) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
  return new Set(words.slice(2).map((_, i) => words.slice(i, i + 3).join(' ')))
}

function overlaps(left: Set<string>, right: Set<string>) {
  const shorter = left.size < right.size ? left : right
  const other = shorter === left ? right : left
  if (shorter.size < 12) return false
  let count = 0
  for (const gram of shorter) if (other.has(gram)) count++
  return count / shorter.size >= 0.5
}

function samePage(a: RetrievedChunk, b: RetrievedChunk) {
  return a.documentId === b.documentId && a.pageNumber === b.pageNumber
}

export function selectWindow(ranked: RetrievedChunk[], limit = 6) {
  const top = ranked.slice(0, limit)
  if (ranked.length <= limit) return top

  const grams = top.map(chunk => trigrams(chunk.content))
  const duplicate = top.findIndex((chunk, index) =>
    top.slice(0, index).some((earlier, i) => samePage(earlier, chunk) && overlaps(grams[index], grams[i]))
  )
  if (duplicate < 0) return top
  const removed = top[duplicate]
  const neighbor = ranked.slice(limit).find(candidate =>
    candidate.documentId === removed.documentId && !samePage(candidate, removed) &&
    top.some(p => samePage(p, candidate) && p.chunkIndex === candidate.chunkIndex + 1)
  )
  return neighbor ? [...top.filter((_, index) => index !== duplicate), neighbor] : top
}

const common = new Set('the and into from how does can for are that with this which what then its have would could should when there than some before after over their they both two'.split(' '))

function stems(text: string) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
  return new Set(words.filter(word => word.length > 2 && !common.has(word)).map(word => word.replace(/(?:ing|ed|s)$/, '')))
}

export function evidenceIndex(question: string, passages: RetrievedChunk[]) {
  const parts = question.split(/,?\s+and\s+(?:then\s+)?|\?\s+(?=\S)/i)
  if (parts.length !== 2 || parts.some(part => stems(part).size < 2)) return ''
  const lines = passages.flatMap((passage, i) =>
    passage.content.split('\n').map(line => ({ citation: i + 1, line }))
  )
  const clues = parts.map(part => {
    const query = stems(part)
    let best: (typeof lines)[number] | undefined
    let highest = 0
    for (const entry of lines) {
      if (entry.line.length < 16 || entry.line.length > 420) continue
      const terms = stems(entry.line)
      const matched = [...query].filter(word => terms.has(word)).length
      const score = matched / Math.sqrt(8 + terms.size)
      if (matched >= 2 && score > highest) {
        best = entry
        highest = score
      }
    }
    return best
  })
  if (!clues[0] || !clues[1] || clues[0].citation === clues[1].citation) return ''
  return '\n\nPassage lookup for this question (untrusted verbatim lines, in question order):\n' +
    JSON.stringify(clues) +
    '\nUse the full excerpts to check each line in context. Give one direct answer. When one documented step yields inputs accepted by another, describe how to apply both, citing each step. If a required fact or link is absent, identify the gap. Relevance alone does not establish a relationship.'
}
