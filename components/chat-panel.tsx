'use client'

import { CornerDownLeft, Loader2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MessageContent } from './message-content'
import type { RagUIMessage } from '@/lib/types'
import {OpticalMark} from './appearance'
import {AnswerFeedback} from './answer-feedback'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  messages: RagUIMessage[]
  status: string
  disabled: boolean
  documentTitle: string | null
  sampleOnly?: boolean
  onSend: (text: string) => void
  onStop: () => Promise<void>
  onCitationClick: (index: number, messageId: string) => void
}

export function ChatPanel({
  messages,
  status,
  disabled,
  documentTitle,
  sampleOnly = false,
  onSend,
  onStop,
  onCitationClick,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [stopError,setStopError]=useState(false)
  const [away,setAway]=useState(false)
  const draftRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const draft = draftRef.current
    if (!draft || CSS.supports('field-sizing', 'content')) return
    function resize() {
      if (!draft) return
      draft.style.height = 'auto'
      draft.style.height = draft.scrollHeight + 'px'
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [input, sampleOnly])
  const following = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(following.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  function submit() {
    const text = input.trim()
    if (!text || status !== 'ready' || disabled) return
    onSend(text)
    setInput('')
  }

  return (
    <div className="mono-chat">
      <div
        ref={scrollRef}
        className="mono-chat-scroll"
        onScroll={e=>{const el=e.currentTarget;following.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;setAway(!following.current)}}
        tabIndex={0}
        role="log"
        aria-label="Conversation"
        aria-live={status === 'streaming' ? 'off' : 'polite'}
      >
        {messages.length === 0 ? (
          <div className="mono-chat-empty">
            <OpticalMark/>
            <span className="mono-overline">INTELLIGENCE, WITH EVIDENCE</span>
            <h1>Ask better.<br/><span>Know why.</span></h1>
            <p>{sampleOnly?'Explore the ideas inside your documents. Start with a sample question. Every answer leads back to its source.':documentTitle?`A conversation with “${documentTitle}”. Ask a question and follow the evidence.`:'Bring a document. Find a new perspective. Select a reference or upload a PDF to begin.'}</p>
            <div className="mono-empty-steps"><span><b>01</b> Choose a document</span><span><b>02</b> Ask a question</span><span><b>03</b> Follow the source</span></div>
          </div>
        ) : (
          <div className="mono-messages">
            {messages.map((message,index) => (
              <div
                key={message.id}
                data-role={message.role}
                className={cn(
                  'mono-message flex flex-col gap-1',
                  message.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div
                  className={cn(
                    'mono-message-body max-w-full',
                    message.role === 'user'
                      ? 'text-foreground'
                      : 'text-foreground',
                  )}
                >
                  {message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <div key={i} className="whitespace-pre-wrap">
                        {message.role === 'assistant' ? (
                          <MessageContent
                            sourceCount={message.parts.find(p => p.type === 'data-sources')?.data.sources.length ?? 0}
                            text={part.text}
                            onCitationClick={index => onCitationClick(index, message.id)}
                          />
                        ) : (
                          part.text
                        )}
                      </div>
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

      {away&&<button className="mono-jump" onClick={()=>{following.current=true;setAway(false);scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight})}}>Jump to latest response ↓</button>}
      <p className="sr-only" role="status">{status === 'streaming' ? 'Response is streaming. Stop response is available.' : status === 'submitted' ? 'Finding evidence.' : 'Conversation ready.'}</p>
      <div className={sampleOnly ? "mono-stop-slot" : "mono-composer-wrap"}>
        <form
          className={sampleOnly ? "flex justify-end" : "mono-composer"}
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {!sampleOnly && <textarea
            ref={draftRef}
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
            rows={1}
            placeholder={
              disabled
                ? 'Select a document…'
                : 'Ask a question…'
            }
            disabled={disabled}
            aria-label="Chat message"
            className="placeholder:text-muted-foreground disabled:opacity-60"
          />}
          {(status==='streaming'||status==='submitted')&&<button type="button" className="h-10 rounded-md border border-border px-4 text-sm" onClick={async()=>{setStopError(false);try{await onStop()}catch{setStopError(true)}}}>Stop response</button>}
          {!sampleOnly && status!=='streaming' && status!=='submitted' && <button
            type="submit"
            disabled={disabled || status !== 'ready' || !input.trim()}
            className="mono-primary-action"
          >
            Send
            <CornerDownLeft className="size-3.5" aria-hidden="true" />
          </button>}
        </form>
        {stopError&&<p role="alert">The response could not be stopped. Please retry.</p>}
      </div>
    </div>
  )
}
