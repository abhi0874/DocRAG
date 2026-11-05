'use client'
import {useState} from 'react'
import useSWR from 'swr'
type Summary={total:number;successful:number;failed:number;cancelled:number;mean_ms:number|null;p50_ms:number|null;p95_ms:number|null;cache_hits:number;cache_misses:number;input_tokens:number|null;output_tokens:number|null;total_tokens:number|null;token_measurements:number}
type Data={scope:string;hours:number;summary:Summary;providers:{provider:string|null;count:number}[];errors:{error_category:string;count:number}[];trends:{hour:string;count:number}[];recent:{request_id:string;created_at:string;method:string;route:string;status:number;outcome:string;latency_ms:number;cache:string|null}[]}
const value=(n:number|null,unit='')=>n===null?'Unavailable':`${n.toLocaleString(undefined,{maximumFractionDigits:2})}${unit}`
export function MetricsDashboard(){
  const [hours,setHours]=useState(24)
  const {data,error,isLoading,mutate}=useSWR<Data>(`/api/metrics?hours=${hours}`,async (url:string)=>{const r=await fetch(url);if(!r.ok)throw new Error(r.status===401?'Sign in to view your metrics.':'Metrics could not be loaded.');return r.json()})
  const s=data?.summary
  return <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Your request metrics</h1><p className="text-sm text-muted-foreground">Recorded requests for your account. Dashboard reads are excluded.</p></div>
    <div className="flex gap-2"><select aria-label="Metrics period" value={hours} onChange={e=>setHours(Number(e.target.value))} className="rounded border border-border bg-card p-2"><option value={1}>Past hour</option><option value={24}>Past 24 hours</option><option value={168}>Past 7 days</option></select><button onClick={()=>mutate()} className="rounded border border-border px-3">Refresh</button></div></div>
    {isLoading&&<p role="status">Loading metrics…</p>}{error&&<p role="alert">{error.message}</p>}
    {s&&<><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries({'Recorded requests':s.total,'Successful':s.successful,'Failed':s.failed,'Cancelled':s.cancelled,'Median latency':value(s.p50_ms,' ms'),'p95 latency':value(s.p95_ms,' ms'),'Eligible cache-hit rate':s.cache_hits+s.cache_misses?value(100*s.cache_hits/(s.cache_hits+s.cache_misses),'%'):'Unavailable','Reported tokens':value(s.total_tokens)}).map(([label,v])=><div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{v}</p></div>)}</div>
      <p className="text-sm text-muted-foreground">Token measurements available for {s.token_measurements} requests. Input: {value(s.input_tokens)}; output: {value(s.output_tokens)}. Cached answers skip generation; unreported tokens remain unavailable.</p>
      <div className="grid gap-4 md:grid-cols-2"><section className="rounded-lg border border-border p-4"><h2 className="font-semibold">Providers</h2>{data.providers.map(r=><p key={r.provider??'none'}>{r.provider??'No model call'}: {r.count}</p>)}</section><section className="rounded-lg border border-border p-4"><h2 className="font-semibold">Error categories</h2>{data.errors.length?data.errors.map(r=><p key={r.error_category}>{r.error_category}: {r.count}</p>):<p>No recorded errors in this period.</p>}</section></div>
      <section><h2 className="mb-2 font-semibold">Hourly request counts</h2><div className="flex max-h-40 flex-wrap gap-3 overflow-auto text-xs">{data.trends.map(r=><p key={r.hour}>{new Date(r.hour).toLocaleString()}: <strong>{r.count}</strong></p>)}</div></section>
      <section className="overflow-x-auto"><h2 className="mb-2 font-semibold">Recent requests</h2><table className="w-full text-left text-sm"><thead><tr>{['Time','Operation','Status','Completion','Latency','Cache'].map(h=><th className="border-b border-border p-2" key={h}>{h}</th>)}</tr></thead><tbody>{data.recent.map(r=><tr key={r.request_id}><td className="p-2">{new Date(r.created_at).toLocaleTimeString()}</td><td className="p-2">{r.method} {r.route}</td><td className="p-2">{r.status}</td><td className="p-2">{r.outcome}</td><td className="p-2">{value(r.latency_ms,' ms')}</td><td className="p-2">{r.cache??'—'}</td></tr>)}</tbody></table></section>
    </>}
  </main>
}
