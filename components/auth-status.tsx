'use client'
import Link from 'next/link'
import useSWR from 'swr'
import {useState} from 'react'
export function AuthStatus(){
  const {data,error,isLoading}=useSWR('/api/auth/get-session',async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Session unavailable');return r.json()})
  const [failed,setFailed]=useState(false)
  if(isLoading)return <span className="text-xs">Checking sign-in…</span>
  if(error)return <span role="alert" className="text-xs">Sign-in service unavailable</span>
  if(!data)return <Link className="rounded border px-3 py-1 text-sm" href="/sign-in">Sign in</Link>
  return <div className="flex items-center gap-2 text-sm"><span>{data.user.name}</span><button className="rounded border px-3 py-1" onClick={async()=>{
    const response=await fetch('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
    // A full navigation clears private SWR/chat state across identity changes.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if(response.ok)window.location.assign('/sign-in');else setFailed(true)
  }}>Sign out</button>{failed && <span role="alert">Sign-out failed. Retry.</span>}</div>
}
