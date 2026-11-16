'use client'

import {Fragment, type ReactNode} from 'react'
import {citationReferences} from '@/lib/citations'

/** A deliberately small, inert Markdown renderer. No HTML, images or remote embeds. */
export function MessageContent({text, sourceCount, onCitationClick}: {
  text: string
  sourceCount: number
  onCitationClick: (index: number) => void
}) {
  // Always validate the whole original answer; parsing individual paragraphs could
  // change the meaning of code examples or attributed literal reference tokens.
  const references = citationReferences(text, sourceCount).filter(reference => reference.valid)
  function inline(start: number, end: number): ReactNode {
    const nodes: ReactNode[] = []
    let cursor = start
    for (const reference of references) {
      if (reference.start < start || reference.end > end) continue
      nodes.push(<Fragment key={`text-${cursor}`}>{format(text.slice(cursor, reference.start))}</Fragment>)
      nodes.push(<button key={reference.start} type="button" className="mono-citation"
        aria-label={`Show source ${reference.number}`}
        onClick={() => onCitationClick(reference.number! - 1)}>{reference.number}</button>)
      cursor = reference.end
    }
    nodes.push(<Fragment key={`text-${cursor}`}>{format(text.slice(cursor, end))}</Fragment>)
    return nodes
  }
  const lines = Array.from(text.matchAll(/[^\r\n]+|\r?\n/g))
  const blocks: ReactNode[] = []
  let code: {fence: string; language: string; content: string; start: number} | null = null
  for (const line of lines) {
    const value = line[0], offset = line.index
    if (code) {
      if (new RegExp('^ {0,3}' + code.fence[0] + '{' + code.fence.length + ',}\\s*$').test(value)) {
        blocks.push(<pre key={code.start} tabIndex={0} aria-label={code.language ? `${code.language} code` : 'Code example'}><code>{code.content.replace(/^\r?\n/, '')}</code></pre>)
        code = null
      } else code.content += value
      continue
    }
    const fence = /^ {0,3}(`{3,}|~{3,})([\w+-]*)\s*$/.exec(value)
    if (fence) {code = {fence: fence[1], language: fence[2], content: '', start: offset}; continue}
    if (/^\r?\n$/.test(value)) continue
    const heading = /^(#{1,6})\s+/.exec(value)
    const list = /^\s*(?:[-*+] |\d+[.)] )/.exec(value)
    const quote = /^>\s?/.exec(value)
    if (heading) blocks.push(<h3 key={offset}>{inline(offset + heading[0].length, offset + value.length)}</h3>)
    else if (list) blocks.push(<ul className="message-list" key={offset}><li className="message-list-item"><span aria-hidden="true">{value.trim().match(/^\d+[.)]/)?.[0] ?? '•'}</span><p>{inline(offset + list[0].length, offset + value.length)}</p></li></ul>)
    else if (quote) blocks.push(<blockquote key={offset}>{inline(offset + quote[0].length, offset + value.length)}</blockquote>)
    else blocks.push(<p key={offset}>{inline(offset, offset + value.length)}</p>)
  }
  if (code) blocks.push(<pre key={code.start} tabIndex={0} aria-label="Code example"><code>{code.content.replace(/^\r?\n/, '')}</code></pre>)
  return <div className="message-content">{blocks}</div>
}

function format(text: string): ReactNode {
  // Unrecognized Markdown is readable literal text. Links remain inert to avoid
  // turning model output into executable URLs or unsolicited outbound navigation.
  const tokens = /(`+)([^`\n]+)\1|\*\*([^*\n]+)\*\*/g
  const output: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(tokens)) {
    output.push(text.slice(cursor, match.index))
    output.push(match[2] ? <code key={match.index}>{match[2]}</code> : <strong key={match.index}>{match[3]}</strong>)
    cursor = match.index + match[0].length
  }
  output.push(text.slice(cursor))
  return output
}
