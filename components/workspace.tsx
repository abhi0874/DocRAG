'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useMemo, useRef, useState } from 'react'
import {LiquidPillGroup} from './ui/liquid-pill-group'
import './workspace.css'
import useSWR from 'swr'
import { ChatPanel } from '@/components/chat-panel'
import { DocumentPanel } from '@/components/document-panel'
import { SourcesPanel } from '@/components/sources-panel'
import type { DocumentInfo, RagUIMessage, SourceChunk } from '@/lib/types'
import { requestMessages } from '@/lib/ui/chat-request'
import {useHostedAccess} from './hosted-access'
import Link from 'next/link'
import {useRouter} from 'next/navigation'

const fetcher = (url: string) => fetch(url).then(async r => {if(!r.ok)throw new Error('Documents unavailable');return r.json()})
function chatErrorMessage(error:Error) {
  try {
    const value=JSON.parse(error.message)
    if(typeof value.error==='string' && value.error.length<=200)return value.error
  } catch { /* Stream failures already contain a generic safe message. */ }
  return 'The response could not be completed. Check your connection, consent and quota before retrying.'
}

export function Workspace({personal=false,cloud=false,enhanced=false}:{personal?:boolean;cloud?:boolean;enhanced?:boolean}={}) {
  const router = useRouter()
  const documentsUrl=personal?'/api/documents?scope=mine':enhanced?'/api/documents?scope=public':'/api/documents'
  const consent = useHostedAccess(cloud && enhanced)
  const aiEnabled = !cloud || !!consent.data?.enabled
  const { data: documents, isLoading, error } = useSWR<DocumentInfo[]>(
    documentsUrl,
    fetcher,
  )
  const library = useRef<HTMLElement>(null)
  const [view,setView]=useState('conversation')
  const [citationFocus,setCitationFocus]=useState(0)
  const [sourcesOpen,setSourcesOpen]=useState(false)
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

  function openLibrary() {
    setView('library')
    requestAnimationFrame(() => {
      const target = library.current?.querySelector<HTMLElement>('.mono-document:not(:disabled)') ?? library.current
      target?.focus()
    })
  }

  return (
    <div className="mono-workspace"><div className="mono-workspace-bar"><p className="mono-breadcrumb">DocRAG <span>/</span> <strong>{personal ? 'Personal studio' : enhanced ? 'Guest studio' : 'Document studio'}</strong></p><div className="mono-mobile-views"><LiquidPillGroup label="Workspace view" value={view} onChange={next=>{setView(next);if(next==='sources')setSourcesOpen(true)}} options={[{value:'library',label:'Library'},{value:'conversation',label:'Ask'},{value:'sources',label:'Sources'}]}/></div><button className="mono-icon-button mono-desktop-toggle" aria-expanded={sourcesOpen} aria-controls="workspace-sources" onClick={()=>setSourcesOpen(!sourcesOpen)}>{sourcesOpen?'Hide evidence':'Show evidence'}</button></div><div className="mono-workspace-grid" data-view={view} data-sources-open={sourcesOpen}>
      <aside ref={library} className="mono-library" aria-label="Document library" tabIndex={-1}>
        {enhanced&&!personal&&!consent.data?.signedIn&&<div className="guest-account-entry"><p>Browse public documents or sign in to ask questions and use your own PDFs.</p><Link href="/sign-up" className="support-action support-action-primary">Create an account</Link><Link href="/workspace" className="underline">Sign in</Link>{cloud && !aiEnabled && <Link href="/guest-access" className="underline">Ask as a guest</Link>}</div>}
        {cloud && (personal || consent.data?.signedIn) && <div className="guest-account-entry">
          <p>{consent.error ? 'Hosted AI preferences could not be loaded.' : consent.data ? (aiEnabled ? 'Hosted AI is on.' : 'Hosted AI is off.') : 'Checking hosted AI access…'}</p>
          <Link className="underline" href="/workspace/hosted-ai">{aiEnabled ? 'Manage hosted AI' : 'Review hosted AI access'}</Link>
        </div>}
        {error&&<p role="alert" className="mono-error">Your documents could not be loaded. Check your connection or <Link href="/sign-in" className="underline">sign in again</Link>.</p>}
        <DocumentPanel
          documents={documents ?? []}
          isLoading={isLoading}
          selectedId={selectedId}
          busy={status==='submitted'||status==='streaming'}
          onSelect={handleSelect}
          selectedIds={enhanced?selectedIds:undefined}
          uploadAllowed={(!enhanced||personal) && aiEnabled}
          manageOwned={!enhanced||personal}
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
          disabled={!aiEnabled || (enhanced?!selectedIds.some(id=>documents?.some(d=>d.id===id)):!selectedDoc)}
          documentTitle={enhanced?documents?.filter(d=>selectedIds.includes(d.id)).map(d=>d.title).join(' + ')||null:selectedDoc?.title ?? null}
          entryAction={!aiEnabled ? (consent.data ? {
            label: 'Review hosted AI access',
            open: () => router.push(consent.data?.signedIn ? '/workspace/hosted-ai' : '/guest-access'),
          } : undefined) : selectedDoc || (enhanced && selectedIds.length) ? undefined : {
            label: personal && !documents?.length ? 'Upload a PDF' : 'Choose a document',
            open: personal && !documents?.length
              ? () => {setView('library');library.current?.querySelector<HTMLInputElement>('input[type=file]')?.click()}
              : openLibrary,
          }}
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
