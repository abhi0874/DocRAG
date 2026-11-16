'use client'

import { ArrowRight, CheckCircle2, FlaskConical, Loader2, ScanText } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import type { DocumentInfo, EvaluationResult } from '@/lib/types'
import './supporting.css'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to access your evaluations.' : 'Your evaluation data could not be loaded.')
  return response.json()
}

export function EvaluationPanel({ demoMode = false }: { demoMode?: boolean }) {
  const { data: documents, error: documentError } = useSWR<DocumentInfo[]>('/api/documents', fetcher)
  const { data: evaluations, isLoading, error: historyError, mutate: refreshHistory } = useSWR<EvaluationResult[]>('/api/evaluations', fetcher)
  const { mutate } = useSWRConfig()
  const [documentId, setDocumentId] = useState('')
  const [question, setQuestion] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runEvaluation() {
    if (demoMode || !documentId || !question.trim() || running) return
    setError(null); setRunning(true)
    try {
      const response = await fetch('/api/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: Number(documentId), question }) })
      const data = await response.json()
      if (!response.ok) setError(data.error ?? 'Evaluation failed')
      else { setQuestion(''); await mutate('/api/evaluations') }
    } catch { setError('Evaluation failed. Please try again.') }
    finally { setRunning(false) }
  }

  return <div className="support-page">
    <header className="support-heading"><div><p className="eyebrow">EVALUATION / A CLOSER LOOK</p><h1>The difference<br />is in the evidence.</h1><p>Compare a document-grounded response with the same model answering on its own. Inspect the answers side by side.</p></div><FlaskConical size={32} strokeWidth={1.2} aria-hidden="true" className="text-primary" /></header>
    {demoMode ? <section className="support-panel p-6"><h2 className="mb-2 font-semibold">Comparisons belong in your local workspace.</h2><p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">The public demo accepts reviewed sample questions only. New evaluations are disabled to protect privacy and shared capacity.</p><Link href="/" className="support-action mt-5">Explore the public demo<ArrowRight size={15} aria-hidden="true" /></Link></section> : <section className="support-panel" aria-label="New answer comparison">
      <div className="support-panel-heading"><h2>Set up a comparison</h2><span className="support-caption">DOCUMENT + QUESTION</span></div>
      <form className="eval-form" aria-busy={running} onSubmit={event => { event.preventDefault(); void runEvaluation() }}>
        <label className="support-field">Source document<select value={documentId} onChange={event => setDocumentId(event.target.value)} disabled={running || !!documentError} aria-label="Select document" className="support-input"><option value="">Select a document…</option>{documents?.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></label>
        <label className="support-field">Your question<input type="text" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }} disabled={running} placeholder="What should this document answer?" aria-label="Evaluation question" className="support-input" /></label>
        <button type="submit" disabled={!documentId || !question.trim() || running || !!documentError} className="support-action support-action-primary min-h-12">{running ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" />Running both…</> : <>Run comparison<ArrowRight size={16} aria-hidden="true" /></>}</button>
      </form>
      {(error || documentError) && <p role="alert" className="support-error mx-6 mb-6">{error ?? documentError.message}</p>}
    </section>}
    <section className="eval-history" aria-label="Your comparison history">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="eyebrow">YOUR COMPARISONS</h2><span className="support-caption">{evaluations?.length ?? 0} SAVED</span></div>
      {isLoading && <p role="status" className="text-sm text-muted-foreground">Loading your comparisons…</p>}
      {historyError && <div className="support-error" role="alert"><p>{historyError.message}</p><button type="button" className="support-action" onClick={() => void refreshHistory()}>Retry</button></div>}
      {!isLoading && !historyError && !evaluations?.length && <div className="support-empty"><ScanText size={30} strokeWidth={1.2} aria-hidden="true" /><h2>A fresh perspective awaits.</h2><p>{demoMode ? 'Your existing comparisons will appear here. Explore sample answers in the public workspace.' : 'Choose a document and a question above. Your grounded and model-only answers will appear here together.'}</p></div>}
      {evaluations?.map(evaluation => <article key={evaluation.id} className="support-panel">
        <header className="border-b border-border p-6"><h3 className="eval-result-title">{evaluation.question}</h3><p className="support-caption mt-3">{evaluation.retrievedChunks.length} SOURCE EXCERPTS · <time dateTime={evaluation.createdAt}>{new Date(evaluation.createdAt).toLocaleString()}</time></p></header>
        <div className="eval-columns"><section className="eval-column"><h4 className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 size={16} aria-hidden="true" />With RAG · document-grounded</h4><p className="eval-answer">{evaluation.ragAnswer}</p></section><section className="eval-column"><h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><FlaskConical size={16} aria-hidden="true" />Without RAG · model only</h4><p className="eval-answer">{evaluation.noRagAnswer}</p></section></div>
      </article>)}
    </section>
  </div>
}
