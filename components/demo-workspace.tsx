'use client'
import {useState} from 'react'
import {useChat} from '@ai-sdk/react'
import {DefaultChatTransport} from 'ai'
import questions from '@/lib/demo-questions.json'
import type {RagUIMessage,SourceChunk} from '@/lib/types'
import {ChatPanel} from './chat-panel'
import {SourcesPanel} from './sources-panel'
export function DemoWorkspace(){
  const [selected,setSelected]=useState(0),[active,setActive]=useState<number|null>(null)
  const {messages,sendMessage,status,setMessages,stop,error}=useChat<RagUIMessage>({transport:new DefaultChatTransport({api:'/api/chat',prepareSendMessagesRequest:({messages,body})=>({body:{documentId:body?.documentId,messages:messages.slice(-1).map(m=>({id:m.id,role:m.role,parts:m.parts.filter(p=>p.type==='text')}))}})})})
  const busy=status==='submitted'||status==='streaming'
  const latest=messages.filter(m=>m.role==='assistant').at(-1)
  const sources:SourceChunk[]=latest?.parts.find(p=>p.type==='data-sources')?.data.sources??[]
  return <main className="flex min-h-0 flex-1 flex-col">
    <section className="space-y-3 border-b p-4 md:px-8">
      <h1 className="text-2xl font-semibold">DocRAG: answers you can check</h1>
      <p>Explore public FastAPI and PostgreSQL documentation. Answers stream with clickable sources. No API key or installation needed.</p>
      <p className="text-sm text-muted-foreground">This limited demo sends only approved sample questions and public excerpts to Gemini. Google may use them to improve its products. Private uploads and conversations belong in local Ollama mode. Capacity is limited; the service may sleep or temporarily reject requests.</p>
      <label className="block" htmlFor="sample-question">Choose a public sample question</label>
      <select id="sample-question" className="w-full rounded border p-2" value={selected} disabled={busy} onChange={e=>setSelected(Number(e.target.value))}>
        {questions.map((q,i)=><option key={i} value={i}>{q.question}</option>)}
      </select>
      <button className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy} onClick={()=>{setMessages([]);setActive(null);void sendMessage({text:questions[selected].question},{body:{documentId:questions[selected].documentId}})}}>Ask about this sample</button>
      {error&&<p role="alert">The demo is unavailable or its quota is full. Wait a minute before trying again. No automatic retry is performed.</p>}
    </section>
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-h-96 min-w-0 flex-1"><ChatPanel messages={messages} status={status} disabled documentTitle="Public documentation" onSend={()=>{}} onStop={stop} onCitationClick={i=>setActive(i)}/></div>
      <aside className="border-t lg:w-85 lg:border-l"><SourcesPanel sources={sources} activeIndex={active}/></aside>
    </div>
  </main>
}
