'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { ChatPanel } from '@/components/chat-panel'
import { DocumentPanel } from '@/components/document-panel'
import { SourcesPanel } from '@/components/sources-panel'
import type { DocumentInfo, RagUIMessage, SourceChunk } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(async r => {if(!r.ok)throw new Error('Documents unavailable');return r.json()})

export function Workspace() {
  const { data: documents, isLoading } = useSWR<DocumentInfo[]>(
    '/api/documents',
    fetcher,
  )
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sourceMessageId, setSourceMessageId] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<number | null>(null)

  const { messages, sendMessage, status, setMessages, stop } = useChat<RagUIMessage>(
    {
      transport: new DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest: ({messages,body}) => ({body:{documentId:body?.documentId,messages:messages.map(m=>({id:m.id,role:m.role,parts:[{type:'text',text:m.parts.filter(p=>p.type==='text').map(p=>p.text).join(' ')}]}))}}) }),
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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="max-h-64 shrink-0 border-b border-border bg-sidebar lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
        <DocumentPanel
          documents={documents ?? []}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </aside>

      <main className="flex min-h-96 min-w-0 flex-1 flex-col">
        <ChatPanel
          messages={messages}
          status={status}
          disabled={!selectedId}
          documentTitle={selectedDoc?.title ?? null}
          onSend={handleSend}
          onStop={stop}
          onCitationClick={(index, messageId) => {setSourceMessageId(messageId); setActiveSource(index)}}
        />
      </main>

      <aside className="shrink-0 border-t border-border bg-sidebar lg:w-85 lg:border-l lg:border-t-0">
        <SourcesPanel sources={latestSources} activeIndex={activeSource} />
      </aside>
    </div>
  )
}
