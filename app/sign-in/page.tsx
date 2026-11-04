'use client'
import {useState} from 'react'
import Link from 'next/link'
export default function SignIn(){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false)
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
    <Link href="/" className="font-semibold">DocRAG</Link><h1 className="text-2xl font-semibold">Sign in</h1>
    <p className="text-sm text-muted-foreground">Use your DocRAG account to upload and access your private documents. Accounts are created by the application owner.</p>
    <form className="flex flex-col gap-4" onSubmit={async event=>{
      event.preventDefault();setBusy(true);setError('')
      const data=new FormData(event.currentTarget)
      try{const response=await fetch('/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:data.get('email'),password:data.get('password')})})
        // A full navigation clears private SWR/chat state across identity changes.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if(response.ok)window.location.assign('/');else setError(response.status===429?'Too many attempts. Please wait and retry.':'Sign-in failed. Check your email and password.')
      }catch{setError('Sign-in service unavailable. Please retry.')}finally{setBusy(false)}
    }}>
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} className="mt-1 w-full rounded border bg-background p-3"/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} className="mt-1 w-full rounded border bg-background p-3"/></label>
      <button disabled={busy} className="rounded bg-primary p-3 text-primary-foreground">{busy?'Signing in…':'Sign in'}</button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form><Link href="/" className="text-sm underline">Browse public documents</Link>
  </main>
}
