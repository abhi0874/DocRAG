'use client'
import {useState} from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {ProcessingConsent} from './processing-consent'

type ConsentState = {signedIn: boolean; enabled: boolean; country?: string | null; acceptedAt?: string | null}
export function useHostedAccess(active: boolean) {
  return useSWR<ConsentState>(active ? '/api/processing-consent' : null, async (url: string) => {
    const response = await fetch(url, {cache: 'no-store'})
    if (!response.ok) throw new Error('Unable to read hosted AI preference')
    return response.json()
  })
}
async function consentAction(action: 'disable') {
  const response = await fetch('/api/processing-consent', {method: 'POST',
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action})})
  if (!response.ok) throw new Error('Unable to update hosted AI preference')
  return response.json()
}

export function HostedAccessPage() {
  const {data, error, mutate} = useHostedAccess(true)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  if (error) return <p role="alert">Hosted AI preferences could not be loaded. <button className="underline" onClick={() => void mutate()}>Retry</button></p>
  if (!data) return <p role="status">Loading hosted AI preference…</p>
  if (!data.signedIn) return <Link href="/sign-in">Sign in to manage hosted AI</Link>
  return <>
    {data.enabled ? <section className="glass-surface rounded-2xl p-6">
      <h2 className="text-xl font-semibold">Hosted AI is on</h2>
      <p className="my-3">Turning it off blocks new questions and uploads. You can still view or delete your documents.</p>
      <button className="support-action" disabled={saving} onClick={async () => {
        setSaving(true); setFailure('')
        try {await consentAction('disable'); await mutate()}
        catch {setFailure('Could not confirm the change. Refresh to check the current setting.')}
        finally {setSaving(false)}
      }}>{saving ? 'Saving…' : 'Turn off hosted AI'}</button>
      {failure && <p role="alert">{failure}</p>}
    </section> : <ProcessingConsent onAccepted={() => void mutate()}/>}
    <Link className="support-action mt-4" href="/workspace">Return to workspace</Link>
  </>
}
