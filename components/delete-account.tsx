'use client'

import Link from 'next/link'
import {useEffect, useRef, useState, type FormEvent} from 'react'
import {Trash2} from 'lucide-react'

export function DeleteAccount({email}: {email: string}) {
  const [confirming, setConfirming] = useState(false)
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [signInRequired, setSignInRequired] = useState(false)
  const startButton = useRef<HTMLButtonElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const matches = entered.trim().toLowerCase() === email.toLowerCase()
  useEffect(() => { if (confirming) emailInput.current?.focus() }, [confirming])

  function cancel() {
    setConfirming(false)
    setEntered('')
    setError('')
    setSignInRequired(false)
    requestAnimationFrame(() => startButton.current?.focus())
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!matches || busy || signInRequired) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: entered.trim()}),
      })
      if (response.ok) {
        // Leave the signed-in React tree and its private client-side caches.
        window.location.replace('/sign-in?deleted=1')
        return
      }
      setSignInRequired(response.status === 401 || response.status === 403)
      const result = await response.json()
      setError(result.error || 'Deletion failed. Please try again.')
    } catch {
      setError('Could not confirm deletion. Check your connection and reload Account settings.')
    }
    setBusy(false)
  }

  return <section aria-labelledby="account-deletion-title" className="glass-surface mt-8 rounded-2xl p-6">
    <h2 id="account-deletion-title" className="text-xl font-semibold">Delete account</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
      This permanently deletes your DocRAG account, uploaded PDFs, search indexes, evaluations and feedback.
      You’ll be signed out on every device. Your Google account stays active.
    </p>
    {confirming ? <form onSubmit={remove} aria-busy={busy} className="mt-5 grid gap-4">
      <label className="support-field">Type your account email to confirm
        <input type="email" autoComplete="off" autoCapitalize="none" spellCheck={false}
          className="support-input" required maxLength={254} disabled={busy}
          ref={emailInput}
          value={entered} onChange={event => setEntered(event.target.value)} />
      </label>
      {error && <p role="alert" className="support-error">{error}{signInRequired && <> <Link href="/sign-in" className="underline">Sign in again</Link></>}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="support-action" disabled={busy} onClick={cancel}>Cancel</button>
        <button type="submit" className="support-action account-delete" disabled={!matches || busy || signInRequired}>
          {busy ? 'Deleting…' : 'Permanently delete my account'}
        </button>
      </div>
    </form> : <button type="button" className="support-action account-delete mt-5" ref={startButton}
      onClick={() => setConfirming(true)}><Trash2 size={16} aria-hidden="true" />Delete account…</button>}
  </section>
}
