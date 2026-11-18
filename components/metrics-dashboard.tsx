'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react'
import './supporting.css'

type Summary = { total: number; successful: number; failed: number; cancelled: number; mean_ms: number | null; p50_ms: number | null; p95_ms: number | null; cache_hits: number; cache_misses: number; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; token_measurements: number }
type Data = { scope: string; hours: number; summary: Summary; providers: { provider: string | null; count: number }[]; errors: { error_category: string; count: number }[]; trends: { hour: string; count: number }[]; recent: { request_id: string; created_at: string; method: string; route: string; status: number; outcome: string; latency_ms: number; cache: string | null }[] }
const value = (n: number | null, unit = '') => n === null ? 'Unavailable' : `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`

export function MetricsDashboard() {
  const [hours, setHours] = useState(24)
  const { data, error, isLoading, isValidating, mutate } = useSWR<Data>(`/api/metrics?hours=${hours}`, async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to view your metrics.' : 'Metrics could not be loaded.')
    return response.json()
  })
  const summary = data?.summary
  const stats = summary ? {
    'Recorded requests': summary.total, 'Successful': summary.successful, 'Failed': summary.failed, 'Cancelled': summary.cancelled,
    'Median latency': value(summary.p50_ms, ' ms'), 'p95 latency': value(summary.p95_ms, ' ms'),
    'Eligible cache-hit rate': summary.cache_hits + summary.cache_misses ? value(100 * summary.cache_hits / (summary.cache_hits + summary.cache_misses), '%') : 'Unavailable',
    'Reported tokens': value(summary.total_tokens),
  } : {}

  return <main id="main-content" className="support-page space-y-7">
    <header className="support-heading">
      <div><p className="eyebrow">Account insights</p><h1>Request activity.</h1><p>A clear view of your activity, response times and model usage. Only requests belonging to your account appear here.</p></div>
      <div className="support-controls">
        <label className="sr-only" htmlFor="metrics-period">Metrics period</label>
        <select id="metrics-period" value={hours} onChange={event => setHours(Number(event.target.value))} className="support-input !w-auto"><option value={1}>Past hour</option><option value={24}>Past 24 hours</option><option value={168}>Past 7 days</option></select>
        <button type="button" onClick={() => void mutate()} disabled={isValidating} className="support-action"><RefreshCw size={15} aria-hidden="true" className={isValidating ? 'animate-spin' : ''} />{isValidating ? 'Refreshing' : 'Refresh'}</button>
      </div>
    </header>
    {isLoading && <div className="support-empty" role="status"><Activity size={28} aria-hidden="true" /><p>Bringing your activity into focus…</p></div>}
    {error && <p className="support-error" role="alert">{error.message} Use Refresh to try again.</p>}
    {summary && data && <>
      <dl className="metrics-stats">{Object.entries(stats).map(([label, measurement]) => <div key={label} className="metrics-stat"><dt>{label}</dt><dd>{measurement}</dd></div>)}</dl>
      <p className="text-sm leading-relaxed text-muted-foreground">Token measurements available for {summary.token_measurements} requests. Input: {value(summary.input_tokens)}; output: {value(summary.output_tokens)}. Cached answers skip generation; unreported tokens remain unavailable.</p>
      <div className="metrics-breakdown">
        <section className="support-panel"><div className="support-panel-heading"><h2>Provider activity</h2><span className="support-caption">MODEL USAGE</span></div><div className="metrics-list">{data.providers.length ? data.providers.map(row => <div className="metrics-list-row" key={row.provider ?? 'none'}><span>{row.provider ?? 'No model call'}</span><strong className="font-mono">{row.count}</strong></div>) : <p className="pt-3 text-sm text-muted-foreground">No provider activity in this period.</p>}</div></section>
        <section className="support-panel"><div className="support-panel-heading"><h2>Error categories</h2><ShieldCheck size={17} aria-hidden="true" className="text-muted-foreground" /></div><div className="metrics-list">{data.errors.length ? data.errors.map(row => <div className="metrics-list-row" key={row.error_category}><span>{row.error_category}</span><strong className="font-mono">{row.count}</strong></div>) : <p className="pt-3 text-sm text-muted-foreground">No recorded errors in this period.</p>}</div></section>
      </div>
      <section className="support-panel"><div className="support-panel-heading"><h2>Hourly activity</h2><span className="support-caption">RECORDED REQUEST COUNTS</span></div><div className="metrics-hours">{data.trends.length ? data.trends.map(row => <p key={row.hour} className="metrics-hour text-muted-foreground"><time dateTime={row.hour}>{new Date(row.hour).toLocaleString()}</time><strong>{row.count}</strong></p>) : <p className="text-sm text-muted-foreground">Activity will appear after your first recorded request.</p>}</div></section>
      <section className="support-panel"><div className="support-panel-heading"><h2>Request ledger</h2><span className="support-caption">RECENT ACTIVITY</span></div><div className="metrics-table-wrap" tabIndex={0} role="region" aria-label="Recent request table, scroll horizontally on small screens"><table className="metrics-table"><caption className="sr-only">Recent requests for your account</caption><thead><tr>{['Time', 'Operation', 'Status', 'Completion', 'Latency', 'Cache'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.recent.map(row => <tr key={row.request_id}><td><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleTimeString()}</time></td><td className="font-mono">{row.method} {row.route}</td><td>{row.status}</td><td><span className="metrics-outcome">{row.outcome}</span></td><td>{value(row.latency_ms, ' ms')}</td><td>{row.cache ?? '—'}</td></tr>)}</tbody></table>{!data.recent.length && <p className="p-6 text-sm text-muted-foreground">No requests recorded in this period.</p>}</div></section>
      <p className="support-caption">ACCOUNT-SCOPED TELEMETRY · Dashboard reads are excluded.</p>
    </>}
  </main>
}
