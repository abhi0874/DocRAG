'use client'
import Link from 'next/link'
import {useState} from 'react'
import {ProcessingConsent} from './processing-consent'
import {GoogleAuthButton} from './google-auth-button'
export function SignUpForm({cloud,googleEnabled}:{cloud:boolean;googleEnabled:boolean}) {
  const [accepted,setAccepted]=useState(!cloud),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false)
  if(!accepted)return <ProcessingConsent registering onAccepted={()=>setAccepted(true)}/>
  return <section className="signin-card glass-surface">
    <h1 className="text-2xl">Create your workspace</h1>
    {done?<p role="status">Registration request accepted. If this is a new address, your account is ready. <Link href="/sign-in" className="underline">Sign in to continue</Link>.</p>:
    <><GoogleAuthButton enabled={googleEnabled} intent="sign-up"/>
    <p>Or register with email and a display name. Keep your password safe. Email recovery is unavailable.</p>
    <form className="signin-form" onSubmit={async e=>{
      e.preventDefault();if(busy)return;setBusy(true);setError('');const data=new FormData(e.currentTarget)
      try {
        const response=await fetch('/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('name'),email:data.get('email'),password:data.get('password')})})
        if(response.ok)setDone(true)
        else setError(response.status===429?'Registration limit reached. Please try again later.':'Registration could not be completed. Check your details and privacy consent.')
      } catch {setError('Connection failed. Please retry.')} finally {setBusy(false)}
    }}>
      <label className="support-field">Display name<input name="name" className="support-input" autoComplete="nickname" minLength={1} maxLength={80} required/></label>
      <label className="support-field">Email<input name="email" type="email" className="support-input" autoComplete="email" maxLength={254} required/></label>
      <label className="support-field">Password (12–128 characters)<input name="password" type="password" className="support-input" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
      <button className="mono-primary-action" disabled={busy}>{busy?'Creating account…':'Create account'}</button>
      {error&&<p role="alert">{error}</p>}
    </form></>}
    <Link href="/sign-in" className="underline">Already have an account? Sign in</Link>
  </section>
}
