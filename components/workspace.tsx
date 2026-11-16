'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useMemo, useState } from 'react'
import {LiquidPillGroup} from './ui/liquid-pill-group'
import './workspace.css'
import useSWR from 'swr'
import { ChatPanel } from '@/components/chat-panel'
import { DocumentPanel } from '@/components/document-panel'
import { SourcesPanel } from '@/components/sources-panel'
import type { DocumentInfo, RagUIMessage, SourceChunk } from '@/lib/types'
import { requestMessages } from '@/lib/ui/chat-request'

const fetcher = (url: string) => fetch(url).then(async r => {if(!r.ok)throw new Error('Documents unavailable');return r.json()})

export function Workspace() {
  const { data: documents, isLoading, error } = useSWR<DocumentInfo[]>(
    '/api/documents',
    fetcher,
  )
  const [view,setView]=useState('conversation')
  const [citationFocus,setCitationFocus]=useState(0)
  const [sourcesOpen,setSourcesOpen]=useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sourceMessageId, setSourceMessageId] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<number | null>(null)

  const { messages, sendMessage, status, setMessages, stop, error: chatError, clearError } = useChat<RagUIMessage>(
    {
      transport: new DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest: ({messages,body}) => ({body:{documentId:body?.documentId,messages:requestMessages(messages)}}) }),
    },
  )

  const selectedDoc =
    documents?.find((d) => d.id === selectedId) ?? null

  // Sources from the most recent assistant message that carries them
  const latestSources: SourceChunk[] = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.role !== 'assistant' || (sourceMessageId && message.id !== sourceMessageId)) continue
      for (const part of message.parts) {
        if (part.type === 'data-sources') {
          return part.data.sources
        }
      }
    }
    return []
  }, [messages, sourceMessageId])

  function handleSelect(id: number) {
    setView('conversation')
    if (id !== selectedId) {
      setSelectedId(id)
      setMessages([])
      setSourceMessageId(null)
      setActiveSource(null)
    }
  }

  function handleSend(text: string) {
    if (!selectedId) return
    setActiveSource(null)
    setSourceMessageId(null)
    sendMessage({ text }, { body: { documentId: selectedId } })
  }

  return (
    <div className="mono-workspace"><div className="mono-workspace-bar"><p className="mono-breadcrumb">WORKSPACE / <strong>Your document studio</strong></p><div className="mono-mobile-views"><LiquidPillGroup label="Workspace view" value={view} onChange={next=>{setView(next);if(next==='sources')setSourcesOpen(true)}} options={[{value:'library',label:'Library'},{value:'conversation',label:'Ask'},{value:'sources',label:'Sources'}]}/></div><button className="mono-icon-button mono-desktop-toggle" aria-expanded={sourcesOpen} aria-controls="workspace-sources" onClick={()=>setSourcesOpen(!sourcesOpen)}>{sourcesOpen?'Hide evidence':'Show evidence'}</button></div><div className="mono-workspace-grid" data-view={view} data-sources-open={sourcesOpen}>
      <aside className="mono-library">
        {error&&<p role="alert" className="mono-error">Your documents could not be loaded. Check your connection and sign-in.</p>}
        <DocumentPanel
          documents={documents ?? []}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </aside>

      <main id="main-content" className="mono-center">
        {chatError&&<p role="alert" className="mono-error">The response could not be completed. Check your connection and try again. <button className="underline" onClick={clearError}>Dismiss error</button></p>}
        <ChatPanel
          messages={messages}
          status={status}
          disabled={!selectedDoc}
          documentTitle={selectedDoc?.title ?? null}
          onSend={handleSend}
          onStop={stop}
          onCitationClick={(index, messageId) => {setSourceMessageId(messageId); setActiveSource(index);setView('sources');setSourcesOpen(true);setCitationFocus(n=>n+1)}}
        />
      </main>

      <aside id="workspace-sources" className="mono-source-region" hidden={!sourcesOpen}>
        <SourcesPanel sources={latestSources} activeIndex={activeSource} focusKey={citationFocus} />
      </aside>
    </div></div>
  )
}
