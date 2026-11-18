'use client'

import {useState} from 'react'

export function GoogleAuthButton({enabled, intent}:{enabled:boolean; intent:'sign-in'|'sign-up'}) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function start() {
    if(busy || !enabled) return
    setBusy(true)
    setError('')
    try {
      const response=await fetch('/api/auth/google/start',{
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({intent}),
      })
      if(!response.ok) {
        setError(response.status===429?'Too many attempts. Please try again later.':
          response.status===403?'Review the hosted privacy conditions before creating an account.':
          'Google sign-in is unavailable. Please try again later.')
        setBusy(false)
        return
      }
      const {url}=await response.json()
      window.location.assign(url)
    } catch {
      setError('Could not reach Google sign-in. Please try again.')
      setBusy(false)
    }
  }
  return <div className="auth-provider">
    <button type="button" className="support-action" disabled={busy || !enabled}
      aria-describedby={enabled?undefined:'google-unavailable'} onClick={start}>
      {busy?'Opening Google…':intent==='sign-up'?'Sign up with Google':'Sign in with Google'}
    </button>
    {!enabled&&<p id="google-unavailable">Google sign-in is unavailable here. Continue with email.</p>}
    {error&&<p role="alert" className="support-error">{error}</p>}
  </div>
}
