'use client'

import {useEffect, useRef, useState} from 'react'
import {SWRConfig} from 'swr'
import {AppearanceControl} from './appearance'
import {LiquidPillGroup} from './ui/liquid-pill-group'
import {ChatPanel} from './chat-panel'
import {SourcesPanel} from './sources-panel'
import type {RagUIMessage, SourceChunk} from '@/lib/types'
import './workspace.css'

const sources: SourceChunk[] = [{id:1,pageNumber:1,chunkIndex:0,vectorScore:.8,keywordScore:.1,rrfScore:.03,content:'PostgreSQL transactions begin with BEGIN and finish with COMMIT. ROLLBACK cancels the transaction.'}]
const answer = '## An all-or-nothing operation\nA **transaction** groups related statements into one operation. Begin with `BEGIN`, then use `COMMIT` to save the changes. [1]\n```sql\nBEGIN;\nSELECT 1;\nCOMMIT;\n```\n- Use ROLLBACK to abandon the transaction. [1]\n- Follow each citation to inspect its supporting passage.'
const options = [{value:'a',label:'Ask'},{value:'b',label:'Source library'},{value:'c',label:'A longer perspective'}]

export function UILab() {
  const [value,setValue]=useState('a'),[dynamic,setDynamic]=useState(false),[narrow,setNarrow]=useState(false)
  const [messages,setMessages]=useState<RagUIMessage[]>([]),[status,setStatus]=useState('ready'),[active,setActive]=useState<number|null>(null),[focusKey,setFocusKey]=useState(0),[pane,setPane]=useState(true)
  const [recording,setRecording]=useState(false),[report,setReport]=useState('No measurement yet.'),[scenario,setScenario]=useState('adjacent')
  const timer=useRef<ReturnType<typeof setInterval>|null>(null)
  const frames=useRef<number[]>([]),longTasks=useRef<number[]>([]),inputs=useRef<number[]>([]),started=useRef(0)
  useEffect(()=>()=>{if(timer.current)clearInterval(timer.current)},[])
  useEffect(()=>{
    if(!recording)return
    frames.current=[];longTasks.current=[];inputs.current=[];started.current=performance.now()
    let last=started.current,frame=0
    const tick=(now:number)=>{frames.current.push(now-last);last=now;frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick)
    const input=(event:Event)=>{const time=event.timeStamp;requestAnimationFrame(()=>inputs.current.push(Math.max(0,performance.now()-time)))}
    window.addEventListener('pointerdown',input);window.addEventListener('keydown',input)
    const observer=typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('longtask')?new PerformanceObserver(list=>{longTasks.current.push(...list.getEntries().map(e=>e.duration))}):null
    observer?.observe({type:'longtask',buffered:false})
    return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('pointerdown',input);window.removeEventListener('keydown',input)}
  },[recording])
  function finish(){
    setRecording(false)
    const sorted=frames.current.slice(2).sort((a,b)=>a-b),pct=(n:number)=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*n))]??0
    const median=pct(.5)
    setReport(JSON.stringify({scenario,glass:document.documentElement.dataset.glass,theme:document.documentElement.dataset.theme,viewport:[innerWidth,innerHeight],userAgent:navigator.userAgent,durationMs:performance.now()-started.current,frames:sorted.length,frameMeanMs:sorted.reduce((a,b)=>a+b,0)/Math.max(1,sorted.length),p50Ms:median,p95Ms:pct(.95),p99Ms:pct(.99),estimatedDroppedFrames:sorted.reduce((total,n)=>total+Math.max(0,Math.round(n/Math.max(1,median))-1),0),inputToNextFrameMs:inputs.current,longTasksSupported:PerformanceObserver.supportedEntryTypes.includes('longtask'),longTasksMs:longTasks.current,provenance:'Actual requestAnimationFrame sampling. Local development build. Synthetic public chat fixture; not model throughput or a hardware refresh-rate certification.'},null,2))
  }
  function stream(){
    if(timer.current)clearInterval(timer.current)
    setStatus('streaming');let count=0;const history=messages,streamId=String(Date.now())
    timer.current=setInterval(()=>{count+=8;setMessages([...history,{id:`fixture-user-${streamId}`,role:'user',parts:[{type:'text',text:'How do transactions work?'}]},{id:`fixture-answer-${streamId}`,role:'assistant',parts:[{type:'data-sources',data:{sources:sources.map(source=>({...source}))}},{type:'text',text:answer.slice(0,count)}]}]);if(count>=answer.length){clearInterval(timer.current!);timer.current=null;setStatus('ready')}},60)
  }
  const displayedSources=messages.at(-1)?.parts.find(part=>part.type==='data-sources')?.data.sources??sources
  const stop=async()=>{if(timer.current)clearInterval(timer.current);timer.current=null;setStatus('ready')}
  return <SWRConfig value={{provider:()=>new Map(),fetcher:async()=>null,isPaused:()=>true}}><main id="main-content" className="p-5">
    <h1 className="display-title text-3xl">Local interaction laboratory</h1><p className="my-3 text-sm">Public synthetic fixtures only. This page makes no model calls. Production returns 404.</p>
    <div className="flex flex-wrap items-center gap-3"><AppearanceControl/><label>Scenario <select className="button-quiet" value={scenario} onChange={e=>setScenario(e.target.value)}>{['adjacent','non-adjacent','rapid-reversal','intensity','theme','sidebar','source','stream-scroll','long-chat','mobile'].map(s=><option key={s}>{s}</option>)}</select></label><button className="button-primary" disabled={recording} onClick={()=>setRecording(true)}>Start measurement</button><button className="button-quiet" disabled={!recording} onClick={finish}>Finish measurement</button><span role="status">{recording?'Recording frames':'Idle'}</span></div>
    <div className="my-5" style={{maxWidth:narrow?300:700}}><LiquidPillGroup label="Test selection" value={value} onChange={setValue} options={dynamic?options.slice(0,2):options}/></div>
    <div className="flex flex-wrap gap-2"><button className="button-quiet" onClick={()=>setDynamic(!dynamic)}>Change options</button><button className="button-quiet" onClick={()=>setNarrow(!narrow)}>Resize selector</button><button className="button-quiet" onClick={()=>setPane(!pane)}>Toggle source pane</button><button className="button-quiet" onClick={stream}>Stream public fixture</button><button className="button-quiet" onClick={()=>{void stop();setMessages(Array.from({length:40},(_,i)=>({id:`fixture-${i}`,role:i%2?'assistant':'user',parts:[{type:'text',text:i%2?answer:'How do transactions work?'},{type:'data-sources',data:{sources}}]})))}}>Load 40-message fixture</button></div>
    <div className="mono-workspace-grid mt-5" style={{height:600,gridTemplateColumns:pane?'minmax(0,1fr) minmax(180px,30%)':'minmax(0,1fr)'}}><section className="mono-center" style={{display:'flex',minHeight:0}}><ChatPanel messages={messages} status={status} disabled={false} documentTitle="Public PostgreSQL fixture" onSend={()=>stream()} onStop={stop} onCitationClick={i=>{setActive(i);setPane(true);setFocusKey(n=>n+1)}}/></section>{pane&&<aside className="mono-source-region" style={{display:'block'}}><SourcesPanel sources={displayedSources} activeIndex={active} focusKey={focusKey}/></aside>}</div>
    <h2 className="mt-5 font-semibold">Measured evidence</h2><pre id="ui-performance-result" className="mt-3 overflow-auto whitespace-pre-wrap text-xs">{report}</pre>
  </main></SWRConfig>
}
