'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useState } from 'react'
import { ArrowUpRight, LogOut } from 'lucide-react'
import './supporting.css'

export function AuthStatus() {
  const { data, error, isLoading } = useSWR('/api/auth/get-session', async url => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Session unavailable')
    return response.json()
  })
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  if (isLoading) return <span role="status" className="auth-status-note">Checking sign-in…</span>
  if (error) return <span role="alert" className="auth-status-note">Sign-in service unavailable</span>
  if (!data) return <Link className="support-action" href="/sign-in">Sign in<ArrowUpRight size={14} aria-hidden="true" /></Link>
  return <div className="auth-account">
    <span className="auth-account-name" title={data.user.name}>{data.user.name}</span>
    <button type="button" className="support-action" disabled={busy} onClick={async () => {
      if (busy) return
      setBusy(true); setFailed(false)
      try {
        const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        // Full navigation clears private SWR/chat state across identity changes.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        if (response.ok) window.location.assign('/sign-in')
        else setFailed(true)
      } catch { setFailed(true) }
      finally { setBusy(false) }
    }}><LogOut size={14} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button>
    {failed && <span role="alert" className="auth-status-note">Sign-out failed. Retry.</span>}
  </div>
}
