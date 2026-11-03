// Mask literal code with one character per UTF-16 code unit so the UI can
// still slice the original answer at the validator's exact source offsets.
const mask = (length: number) => '\0'.repeat(length)
const attribution = /\b(?:sources?|citations?|references?|excerpts?)\s*[:#]?\s*$/i

function inlineCode(paragraph: string) {
  let start = 0, prose = '', complete = true
  const ticks = /`+/g
  for (let run; (run = ticks.exec(paragraph));) {
    const escapes = /\\+$/.exec(paragraph.slice(start, run.index))
    const escaped = (escapes?.[0].length ?? 0) % 2
    const width = run[0].length - escaped
    if (!width) continue
    const open = run.index + escaped
    const content = ticks.lastIndex
    // Inside a span even an escaped matching run closes it.
    const close = new RegExp('(?<!`)`{' + width + '}(?!`)', 'g')
    close.lastIndex = content
    const end = close.exec(paragraph)
    if (!end) {
      complete = false
      continue
    }
    const literal = paragraph.slice(content, end.index)
    const before = paragraph.slice(start, open)
    prose += before
    // “According to source `[-1]`” still makes an explicit attribution.
    if (attribution.test(before) && /^\s*\[[^\[\]]*\]\s*$/.test(literal)) {
      prose += ' '.repeat(width) + literal + ' '.repeat(width)
    } else {
      prose += mask(close.lastIndex - open)
    }
    start = ticks.lastIndex = close.lastIndex
  }
  return {prose: prose + paragraph.slice(start), complete}
}

export function citationProse(text: string) {
  const pieces: string[] = []
  let paragraph = '', fence = '', indented = false, complete = true
  let listIndent = 0
  function flush() {
    if (!paragraph) return
    const span = inlineCode(paragraph)
    pieces.push(span.prose)
    complete &&= span.complete
    paragraph = ''
  }
  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    const [raw, line, ending] = match
    // A fenced example can belong to a list item. Interpret indentation
    // relative to the item, but always mask the original source offsets.
    if (listIndent && line.trim() && !line.startsWith(' '.repeat(listIndent))) {
      if (fence) complete = false
      fence = ''
      listIndent = 0
      indented = false
      flush()
    }
    const item = !fence && /^ {0,3}(?:[*+-]|\d{1,9}[.)]) {1,4}(?=\S)/.exec(line)
    if (item) {
      flush()
      indented = false
      listIndent = item[0].length
    }
    const relative = line.slice(listIndent)
    const marker = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(relative)
    if (fence) {
      pieces.push(mask(line.length), ending)
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length &&
          /^[ \t]*$/.test(marker[2])) fence = ''
      continue
    }
    if (marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      flush()
      fence = marker[1]
      indented = false
      pieces.push(mask(line.length), ending)
    } else if (!line.trim()) {
      flush()
      pieces.push(raw)
    } else if ((indented || !paragraph) && /^(?: {4}| {0,3}\t)/.test(relative)) {
      indented = true
      pieces.push(mask(line.length), ending)
    } else {
      indented = false
      paragraph += raw
    }
  }
  flush()
  return {prose: pieces.join(''), complete: complete && !fence}
}
