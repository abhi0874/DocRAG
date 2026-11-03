import {citationProse} from './citation-code'

interface Reference {
  start: number
  end: number
  token: string
  number: number | null
  valid: boolean
}

// Preserve the model's canonical refusal and narrow evidence-only equivalents.
// Match the entire answer so a refusal followed by an uncited claim cannot pass.
const refusal = /^(?:I could not find (?:this|that) in the document|I cannot determine (?:that|this) from the (?:supplied|provided) (?:documents?|excerpts?|evidence)|(?:The )?(?:available|provided|supplied) (?:excerpts|documents|evidence) (?:do not|does not) establish (?:this|that|the requested (?:fact|information)))[.!]?$/i

// Return offsets in the original text. The display and validator must interpret
// literal examples and actual source markers identically.
function referencesInProse(text: string, sourceCount: number): Reference[] {
  const references: Reference[] = []
  const tokens = /\[([^\[\]\r\n]*)(\]|(?=\[|\r|\n|$))/g
  for (let match; (match = tokens.exec(text));) {
    const start = match.index
    const body = match[1]
    // A Markdown inline link is literal, including numeric labels/destination.
    if (match[2] && text[tokens.lastIndex] === '(') {
      let depth = 1, end = tokens.lastIndex + 1
      while (end < text.length && depth && text[end] !== '\n') {
        const char = text[end++]
        if (char === '\\') end++
        else if (char === '(') depth++
        else if (char === ')') depth--
      }
      if (!depth) { tokens.lastIndex = end; continue }
    }
    const prefix = text.slice(Math.max(0, start - 80), start)
    const attributed = /\b(?:sources?|citations?|references?|excerpts?)\s*[:#]?\s*["“']?$/i.test(prefix)
    const quotedExample = /\b(?:literal|example|token|string|syntax)\s+["“']$/i.test(prefix)
    if (quotedExample && /["”']/.test(text[tokens.lastIndex] ?? '')) continue
    // A bare [] after prose is an empty marker. Keep ordinary data literals
    // such as “the empty array []” and “values = []” as text.
    const emptyMarker = !body.trim() && !/(?:\b(?:array|list|brackets)|=)\s*$/i.test(prefix)
    if (!attributed && !emptyMarker && !/^\s*[+\-−]?\s*\d/.test(body)) continue
    const numeric = /^-?\d+$/.test(body) ? Number(body) : null
    const valid = match[2] === ']' && /^[1-9]\d*$/.test(body) &&
      numeric !== null && Number.isSafeInteger(numeric) && numeric <= sourceCount
    references.push({start, end: tokens.lastIndex, token: match[0], number: numeric, valid})
  }
  return references
}

export function citationReferences(text: string, sourceCount: number) {
  return referencesInProse(citationProse(text).prose, sourceCount)
}

export function validateCitations(text: string, sourceCount: number) {
  const {prose, complete} = citationProse(text)
  const refs = referencesInProse(prose, sourceCount)
  const malformed = refs.filter(ref => !ref.valid)
  const adjacentDuplicates = refs.some((ref, index) => index > 0 && ref.valid &&
    ref.number === refs[index - 1].number && !text.slice(refs[index - 1].end, ref.start).trim())
  const kind = !complete ? 'ambiguous-code' : malformed.length || adjacentDuplicates ? 'invalid-references'
    : refs.length ? 'cited' : refusal.test(text.trim()) ? 'uncited-refusal' : 'missing-references'
  return {
    valid: kind === 'cited' || kind === 'uncited-refusal',
    kind, numbers: refs.flatMap(ref => ref.number === null ? [] : [ref.number]),
    invalid: malformed.flatMap(ref => ref.number === null ? [] : [ref.number]),
    invalidTokens: malformed.map(ref => ref.token), adjacentDuplicates,
    semanticSupport: 'not-verified' as const,
  }
}
