'use client'

import { CornerDownLeft, Loader2, MessageSquareText } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { citationReferences } from '@/lib/citations'
import type { RagUIMessage } from '@/lib/types'
import {AnswerFeedback} from './answer-feedback'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  messages: RagUIMessage[]
  status: string
  disabled: boolean
  documentTitle: string | null
  onSend: (text: string) => void
  onStop: () => Promise<void>
  onCitationClick: (index: number, messageId: string) => void
}

/** Render assistant text, turning [n] citations into clickable chips. */
function CitedText({
  text,
  onCitationClick,
  sourceCount,
}: {
  sourceCount: number
  text: string
  onCitationClick: (index: number) => void
}) {
  const references = citationReferences(text, sourceCount).filter(ref => ref.valid)
  return <>
    {references.map((ref, index) => {
      const before = text.slice(references[index - 1]?.end ?? 0, ref.start)
      const number = ref.number!
      return <Fragment key={ref.start}>
        {before}<button
          type="button"
          onClick={() => onCitationClick(number - 1)}
          className="mx-0.5 inline-flex size-5 items-center justify-center rounded bg-primary/15 align-text-top font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/30"
          aria-label={`Show source ${number}`}
        >{number}</button>
      </Fragment>
    })}
    {text.slice(references.at(-1)?.end ?? 0)}
  </>
}

export function ChatPanel({
  messages,
  status,
  disabled,
  documentTitle,
  onSend,
  onStop,
  onCitationClick,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [stopError,setStopError]=useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  function submit() {
    const text = input.trim()
    if (!text || status !== 'ready' || disabled) return
    onSend(text)
    setInput('')
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-8"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-lg border border-border bg-card">
              <MessageSquareText
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="text-sm font-medium">
                {documentTitle
                  ? `Ask anything about "${documentTitle}"`
                  : 'Select or upload a document to start'}
              </p>
              <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
                Answers are grounded in retrieved excerpts with inline
                citations. Click a citation to inspect the source chunk.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {messages.map((message,index) => (
              <div
                key={message.id}
                className={cn(
                  'flex flex-col gap-1',
                  message.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card',
                  )}
                >
                  {message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <p key={i} className="whitespace-pre-wrap">
                        {message.role === 'assistant' ? (
                          <CitedText
                            sourceCount={message.parts.find(p => p.type === 'data-sources')?.data.sources.length ?? 0}
                            text={part.text}
                            onCitationClick={index => onCitationClick(index, message.id)}
                          />
                        ) : (
                          part.text
                        )}
                      </p>
                    ) : part.type === 'data-cache' && part.data.status === 'HIT' ? (
                      <p key={i} className="mt-2 text-xs text-muted-foreground">Previously generated answer</p>
                    ) : part.type === 'data-validation' && !part.data.valid ? (
                      <p key={i} className="mt-2 text-xs">Some source references could not be verified. Check the excerpts before relying on this answer.</p>
                    ) : null,
                  )}
                </div>
                {message.role==='assistant'&&<AnswerFeedback answerId={message.id} complete={status==='ready'||index<messages.length-1}/>}
              </div>
            ))}
            {status === 'submitted' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Retrieving relevant chunks...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                e.keyCode !== 229
              ) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder={
              disabled
                ? 'Select a document first...'
                : 'Ask a question about the document...'
            }
            disabled={disabled}
            aria-label="Chat message"
            className="min-h-16 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          {(status==='streaming'||status==='submitted')&&<button type="button" className="h-10 rounded-md border border-border px-4 text-sm" onClick={async()=>{setStopError(false);try{await onStop()}catch{setStopError(true)}}}>Stop response</button>}
          <button
            type="submit"
            disabled={disabled || status !== 'ready' || !input.trim()}
            className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Send
            <CornerDownLeft className="size-3.5" aria-hidden="true" />
          </button>
        </form>
        {stopError&&<p role="alert">The response could not be stopped. Please retry.</p>}
      </div>
    </div>
  )
}
