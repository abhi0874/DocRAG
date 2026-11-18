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
import {ProcessingConsent} from './processing-consent'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(async r => {if(!r.ok)throw new Error('Documents unavailable');return r.json()})
function chatErrorMessage(error:Error) {
  try {
    const value=JSON.parse(error.message)
    if(typeof value.error==='string' && value.error.length<=200)return value.error
  } catch { /* Stream failures already contain a generic safe message. */ }
  return 'The response could not be completed. Check your connection, consent and quota before retrying.'
}

export function Workspace({personal=false,cloud=false,enhanced=false}:{personal?:boolean;cloud?:boolean;enhanced?:boolean}={}) {
  const documentsUrl=personal?'/api/documents?scope=mine':enhanced?'/api/documents?scope=public':'/api/documents'
  const [consented,setConsented]=useState(!cloud)
  const { data: documents, isLoading, error } = useSWR<DocumentInfo[]>(
    documentsUrl,
    fetcher,
  )
  const [view,setView]=useState('conversation')
  const [citationFocus,setCitationFocus]=useState(0)
  const [sourcesOpen,setSourcesOpen]=useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedIds,setSelectedIds]=useState<number[]>([])
  const [sourceMessageId, setSourceMessageId] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<number | null>(null)

  const { messages, sendMessage, status, setMessages, stop, error: chatError, clearError } = useChat<RagUIMessage>(
    {
      transport: new DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest: ({messages,body}) => ({body:{...(enhanced?{documentIds:body?.documentIds,personal}:{documentId:body?.documentId}),messages:requestMessages(messages)}}) }),
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
    if(status==='submitted'||status==='streaming')return
    setView('conversation')
    if(enhanced) {
      setSelectedIds(ids=>ids.includes(id)?ids.filter(value=>value!==id):ids.length<3?[...ids,id]:ids)
      setMessages([]);setSourceMessageId(null);setActiveSource(null);return
    }
    if (id !== selectedId) {
      setSelectedId(id)
      setMessages([])
      setSourceMessageId(null)
      setActiveSource(null)
    }
  }

  function handleSend(text: string) {
    if (enhanced ? !selectedIds.length : !selectedId) return
    setActiveSource(null)
    setSourceMessageId(null)
    sendMessage({ text }, { body: enhanced?{documentIds:selectedIds}:{documentId: selectedId} })
  }

  if(!consented)return <ProcessingConsent onAccepted={()=>setConsented(true)}/>
  return (
    <div className="mono-workspace"><div className="mono-workspace-bar"><p className="mono-breadcrumb">WORKSPACE / <strong>Your document studio</strong></p><div className="mono-mobile-views"><LiquidPillGroup label="Workspace view" value={view} onChange={next=>{setView(next);if(next==='sources')setSourcesOpen(true)}} options={[{value:'library',label:'Library'},{value:'conversation',label:'Ask'},{value:'sources',label:'Sources'}]}/></div><button className="mono-icon-button mono-desktop-toggle" aria-expanded={sourcesOpen} aria-controls="workspace-sources" onClick={()=>setSourcesOpen(!sourcesOpen)}>{sourcesOpen?'Hide evidence':'Show evidence'}</button></div><div className="mono-workspace-grid" data-view={view} data-sources-open={sourcesOpen}>
      <aside className="mono-library">
        {enhanced&&!personal&&<p className="p-4 text-sm">Ask your own questions about these public documents, or <Link href="/workspace" className="underline">sign in to upload your documents</Link>.</p>}
        {error&&<p role="alert" className="mono-error">Your documents could not be loaded. Check your connection or <Link href="/sign-in" className="underline">sign in again</Link>.</p>}
        <DocumentPanel
          documents={documents ?? []}
          isLoading={isLoading}
          selectedId={selectedId}
          busy={status==='submitted'||status==='streaming'}
          onSelect={handleSelect}
          selectedIds={enhanced?selectedIds:undefined}
          uploadAllowed={!enhanced||personal}
          cloud={cloud}
          documentsUrl={documentsUrl}
          onDeleted={id=>{setSelectedIds(ids=>ids.filter(value=>value!==id));if(id===selectedId)setSelectedId(null);setMessages([]);setSourceMessageId(null)}}
        />
      </aside>

      <main id="main-content" className="mono-center">
        {chatError&&<p role="alert" className="mono-error">{chatErrorMessage(chatError)} <Link href="/sign-in" className="underline">Sign in</Link> · <button className="underline" onClick={clearError}>Dismiss and retry</button></p>}
        <ChatPanel
          messages={messages}
          status={status}
          disabled={enhanced?!selectedIds.some(id=>documents?.some(d=>d.id===id)):!selectedDoc}
          documentTitle={enhanced?documents?.filter(d=>selectedIds.includes(d.id)).map(d=>d.title).join(' + ')||null:selectedDoc?.title ?? null}
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
