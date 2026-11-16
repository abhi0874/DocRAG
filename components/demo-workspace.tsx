'use client'
import {useState} from 'react'
import {useChat} from '@ai-sdk/react'
import {DefaultChatTransport} from 'ai'
import {ArrowUpRight,FileText,PanelRightClose,PanelRightOpen,ShieldCheck} from 'lucide-react'
import questions from '@/lib/demo-questions.json'
import type {RagUIMessage,SourceChunk} from '@/lib/types'
import {ChatPanel} from './chat-panel'
import {SourcesPanel} from './sources-panel'
import {LiquidPillGroup} from './ui/liquid-pill-group'
import './workspace.css'
export function DemoWorkspace(){
 const [selected,setSelected]=useState(0),[active,setActive]=useState<number|null>(null),[view,setView]=useState('conversation'),[sourcesOpen,setSourcesOpen]=useState(true),[citationFocus,setCitationFocus]=useState(0)
 const {messages,sendMessage,status,setMessages,stop,error}=useChat<RagUIMessage>({transport:new DefaultChatTransport({api:'/api/chat',prepareSendMessagesRequest:({messages,body})=>({body:{documentId:body?.documentId,messages:messages.slice(-1).map(m=>({id:m.id,role:m.role,parts:m.parts.filter(p=>p.type==='text')}))}})})})
 const busy=status==='submitted'||status==='streaming'
 const latest=messages.filter(m=>m.role==='assistant').at(-1)
 const sources:SourceChunk[]=latest?.parts.find(p=>p.type==='data-sources')?.data.sources??[]
 const documentId=questions[selected].documentId
 return <main id="main-content" className="mono-workspace">
  <div className="mono-workspace-bar"><p className="mono-breadcrumb"><span className="mono-demo-dot"/>PUBLIC EDITION <span>/</span><strong>Your space for clarity</strong></p><div className="mono-mobile-views"><LiquidPillGroup label="Workspace view" value={view} onChange={next=>{setView(next);if(next==='sources')setSourcesOpen(true)}} options={[{value:'library',label:'Library'},{value:'conversation',label:'Ask'},{value:'sources',label:'Sources'}]}/></div><button className="mono-icon-button mono-desktop-toggle" aria-expanded={sourcesOpen} aria-controls="demo-sources" onClick={()=>setSourcesOpen(!sourcesOpen)}>{sourcesOpen?<PanelRightClose/>:<PanelRightOpen/>}{sourcesOpen?'Hide evidence':'Show evidence'}</button></div>
  <div className="mono-workspace-grid" data-view={view} data-sources-open={sourcesOpen}>
   <aside className="mono-library" aria-label="Public document library"><div className="mono-panel-heading"><h2>Your library</h2><span className="mono-count">02</span></div><p className="mono-library-intro">Two public references.<br/>A hundred ways to explore.</p><ul className="mono-document-list">{[{id:3,title:'FastAPI',detail:'Build with Python',tag:'API DEVELOPMENT'},{id:4,title:'PostgreSQL',detail:'Understand your data',tag:'DATABASE SYSTEMS'}].map(doc=><li key={doc.id}><button className="mono-document" aria-pressed={documentId===doc.id} disabled={busy} onClick={()=>{setSelected(questions.findIndex(q=>q.documentId===doc.id));setView('conversation')}}><span className="mono-document-icon"><FileText size={17}/></span><span><span className="mono-overline">{doc.tag}</span><span className="mono-document-title">{doc.title}</span><span className="mono-document-meta">{doc.detail}</span></span></button></li>)}</ul><div className="mono-library-footnote"><ShieldCheck/><p>Public documents only.<br/>Your curiosity, with clear boundaries.</p></div><details className="mono-privacy"><summary>Privacy & demo limits</summary><p>Only approved sample questions and public excerpts are sent to Gemini. Google may use them to improve its products. Private uploads and conversations are available in local Ollama mode. This free service may sleep; shared quotas can temporarily limit access.</p></details></aside>
   <section className="mono-center" aria-label="Document conversation"><ChatPanel messages={messages} status={status} disabled sampleOnly documentTitle={documentId===3?'FastAPI documentation':'PostgreSQL documentation'} onSend={()=>{}} onStop={stop} onCitationClick={i=>{setActive(i);setSourcesOpen(true);setView('sources');setCitationFocus(n=>n+1)}}/>
    <div className="mono-sample-composer"><label htmlFor="sample-question">A good question is a good beginning.</label><div className="mono-sample-row"><select id="sample-question" aria-label="Choose a public sample question" value={selected} disabled={busy} onChange={e=>setSelected(Number(e.target.value))}>{questions.map((q,i)=>q.documentId===documentId&&<option key={i} value={i}>{q.question}</option>)}</select><button className="mono-primary-action" disabled={busy} onClick={()=>{setMessages([]);setActive(null);void sendMessage({text:questions[selected].question},{body:{documentId:documentId}})}}>Ask question<ArrowUpRight/></button></div><div className="mono-sample-footnote"><span>Grounded in public documentation.</span><span>Gemini · Limited free demo</span></div>{error&&<p role="alert" className="mono-error">The demo is unavailable or its quota is full. Wait a minute before trying again. No automatic retry is performed.</p>}</div>
   </section>
   <aside id="demo-sources" className="mono-source-region" hidden={!sourcesOpen} aria-label="Evidence"><SourcesPanel sources={sources} activeIndex={active} focusKey={citationFocus}/></aside>
  </div>
 </main>
}
