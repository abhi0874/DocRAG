'use client'
import {useState} from 'react'
import useSWR from 'swr'
import {ThumbsUp,ThumbsDown} from 'lucide-react'
const fetcher=async(url:string)=>{const r=await fetch(url);if(!r.ok)throw new Error('Feedback is unavailable for this response.');return r.json()}
export function AnswerFeedback({answerId,complete}:{answerId:string;complete:boolean}){
  const {data:session}=useSWR('/api/auth/get-session',fetcher)
  const eligible=complete&&!!session?.user&&/^[0-9a-f-]{36}$/.test(answerId)
  const {data,error,mutate}=useSWR<{value:'up'|'down'|null}>(eligible?`/api/feedback?answerId=${answerId}`:null,fetcher,{shouldRetryOnError:false})
  const [busy,setBusy]=useState(false),[failure,setFailure]=useState('')
  if(!eligible)return null
  async function submit(value:'up'|'down'){
    if(busy||data?.value===value)return
    setBusy(true);setFailure('')
    try{
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answerId,value})})
      if(!response.ok)throw new Error(response.status===429?'Please wait before submitting feedback again.':'Feedback could not be saved. Please retry.')
      await mutate(await response.json(),false)
    }catch(error){setFailure(error instanceof Error?error.message:'Feedback could not be saved.')}finally{setBusy(false)}
  }
  if(error)return <p className="text-xs text-muted-foreground">Feedback is unavailable for this response.</p>
  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="text-muted-foreground">Was this answer helpful?</span>
    <button type="button" aria-label="Helpful answer" aria-pressed={data?.value==='up'} disabled={busy||!data} onClick={()=>submit('up')} className="rounded border border-border p-2 aria-pressed:bg-primary/20 disabled:opacity-50"><ThumbsUp className="size-4"/></button>
    <button type="button" aria-label="Unhelpful answer" aria-pressed={data?.value==='down'} disabled={busy||!data} onClick={()=>submit('down')} className="rounded border border-border p-2 aria-pressed:bg-primary/20 disabled:opacity-50"><ThumbsDown className="size-4"/></button>
    <span role="status">{failure||(busy?'Saving…':data?.value?'Feedback saved':'')}</span>
  </div>
}
