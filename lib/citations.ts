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
export function citationReferences(text: string, sourceCount: number): Reference[] {
  const references: Reference[] = []
  const tokens = /(^ {0,3}(?:`{3,}|~{3,}))|(`+)|\[([^\[\]\n]*)(\]|(?=\[|\n|$))/gm
  for (let match; (match = tokens.exec(text));) {
    const start = match.index
    if (match[1]) {
      const fence = match[1].trim()
      const closing = new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}[ \\t]*$', 'gm')
      const newline = text.indexOf('\n', tokens.lastIndex)
      closing.lastIndex = newline < 0 ? text.length : newline + 1
      tokens.lastIndex = closing.exec(text) ? closing.lastIndex : text.length
      continue
    }
    if (match[2]) {
      const closing = new RegExp('(?<!`)`{' + match[2].length + '}(?!`)', 'g')
      closing.lastIndex = tokens.lastIndex
      if (closing.exec(text)) tokens.lastIndex = closing.lastIndex
      continue
    }
    const body = match[3]
    // A Markdown inline link is literal, including numeric labels/destination.
    if (match[4] && text[tokens.lastIndex] === '(') {
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
    if (!attributed && !/^\s*[+\-−]?\s*\d/.test(body)) continue
    const numeric = /^-?\d+$/.test(body) ? Number(body) : null
    const valid = match[4] === ']' && /^[1-9]\d*$/.test(body) &&
      numeric !== null && Number.isSafeInteger(numeric) && numeric <= sourceCount
    references.push({start, end: tokens.lastIndex, token: match[0], number: numeric, valid})
  }
  return references
}

export function validateCitations(text: string, sourceCount: number) {
  const refs = citationReferences(text, sourceCount)
  const malformed = refs.filter(ref => !ref.valid)
  const adjacentDuplicates = refs.some((ref, index) => index > 0 && ref.valid &&
    ref.number === refs[index - 1].number && !text.slice(refs[index - 1].end, ref.start).trim())
  const kind = malformed.length || adjacentDuplicates ? 'invalid-references'
    : refs.length ? 'cited' : refusal.test(text.trim()) ? 'uncited-refusal' : 'missing-references'
  return {
    valid: kind === 'cited' || kind === 'uncited-refusal',
    kind, numbers: refs.flatMap(ref => ref.number === null ? [] : [ref.number]),
    invalid: malformed.flatMap(ref => ref.number === null ? [] : [ref.number]),
    invalidTokens: malformed.map(ref => ref.token), adjacentDuplicates,
    semanticSupport: 'not-verified' as const,
  }
}
