'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { OpticalPlate } from './ui/optical-plate'
import { AppHeader } from '@/components/app-header'
import { GoogleAuthButton } from './google-auth-button'
import '@/components/supporting.css'

export default function SignIn({enhanced=false,googleEnabled=false,googleFailed=false,accountDeleted=false}:{
  enhanced?:boolean; googleEnabled?:boolean; googleFailed?:boolean; accountDeleted?:boolean
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  return <div className="min-h-dvh">
    <AppHeader enhanced={enhanced}/>
    <main className="signin-layout" id="main-content">
      <section className="signin-editorial" aria-labelledby="signin-heading">
        <OpticalPlate/>
        <h1 id="signin-heading">Your document<br /><span>studio.</span></h1>
        <p>Sign in to open your document library and ask questions with sources.</p>
        <div className="signin-detail"><ShieldCheck size={23} aria-hidden="true" /><span>Private libraries stay tied to your account.<br />Every answer starts with a source.</span></div>
      </section>
      <section className="signin-card glass-surface" aria-labelledby="signin-form-heading">
        <LockKeyhole className="mb-6 text-primary" size={23} aria-hidden="true" />
        <h2 id="signin-form-heading">Welcome back.</h2>
        {accountDeleted&&<p role="status">Your DocRAG account has been deleted.</p>}
        {enhanced&&<div className="auth-entry"><span>New to DocRAG?</span><Link href="/sign-up" className="support-action">Create an account<ArrowRight size={16} aria-hidden="true"/></Link></div>}
        {googleFailed&&<p role="alert" className="support-error">Google sign-in didn’t finish. Use the method you registered with, or create an account if you’re new.</p>}
        {enhanced&&<GoogleAuthButton enabled={googleEnabled} intent="sign-in"/>}
        <p className="text-sm leading-relaxed text-muted-foreground">{enhanced?'Sign in with email':'Sign in with your owner-created DocRAG account.'}</p>
        <form className="signin-form" aria-busy={busy} onSubmit={async event => {
          event.preventDefault()
          if (busy) return
          setBusy(true); setError('')
          const data = new FormData(event.currentTarget)
          try {
            const response = await fetch('/api/auth/sign-in/email', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
            })
            // Full navigation clears private SWR/chat state across identity changes.
            if (response.ok) window.location.assign(enhanced?'/workspace':'/')
            else setError(response.status === 429 ? 'Too many attempts. Please wait and retry.' : 'Sign-in failed. Check your email and password.')
          } catch { setError('Sign-in service unavailable. Please retry.') }
          finally { setBusy(false) }
        }}>
          <label className="support-field">Email address<input name="email" type="email" autoComplete="username" required maxLength={254} className="support-input" placeholder="you@example.com" aria-describedby={error ? 'signin-error' : undefined} /></label>
          <label className="support-field" htmlFor="signin-password">Password</label>
          <div className="signin-password -mt-3">
            <input id="signin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} className="support-input" aria-describedby={error ? 'signin-error' : undefined} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
          </div>
          <button disabled={busy} className="support-action support-action-primary">{busy ? 'Signing in…' : 'Enter your workspace'}<ArrowRight size={16} aria-hidden="true" /></button>
          {error && <p id="signin-error" role="alert" className="support-error">{error}</p>}
        </form>
        <div className="signin-footer">Just exploring? You don’t need an account for the public demo.<br /><Link href="/" className="mt-2 inline-flex min-h-11 items-center gap-2 font-medium text-foreground underline underline-offset-4">Browse public documents<ArrowRight size={14} aria-hidden="true" /></Link></div>
      </section>
    </main>
  </div>
}
