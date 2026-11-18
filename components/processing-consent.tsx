'use client'
import {useState} from 'react'

export function ProcessingConsent({onAccepted}:{onAccepted:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <section className="glass-surface processing-notice" aria-labelledby="processing-title">
    <h2 id="processing-title" className="text-lg font-semibold">Before using hosted AI</h2>
    <p className="mt-3">Questions and document excerpts go to Google Gemini’s unpaid service. Google may use inputs and responses to improve its products, and human reviewers may review them.</p>
    <p className="mt-3 font-medium">Do not upload personal, confidential or sensitive information. Use local Ollama for those documents.</p>
    <p className="mt-3">This limited hosted workspace is for adults using it professionally in India or the United States. It is unavailable elsewhere, including the EEA, UK and Switzerland. Your location is self-declared; we do not claim it is independently verified.</p>
    <p className="mt-3">PDFs expire after 30 days and are removed on the next active library or chat request. You can delete them sooner. Deletion removes application originals and vectors; it does not promise removal of provider-retained data or backups. Free capacity is shared and limited. No payment is required.</p>
    <a className="underline" href="https://aistudio.google.com/docs/terms" target="_blank" rel="noreferrer">Read Google’s processing terms</a>
    <form className="mt-4 grid gap-3" onSubmit={async e=>{
      e.preventDefault();if(busy)return;setBusy(true);setError('')
      const data=new FormData(e.currentTarget)
      try {
        const response=await fetch('/api/processing-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:data.get('country'),adult:true,professional:true,nonSensitive:true,externalProcessing:true})})
        if(!response.ok) {setError('Consent could not be saved. Check eligibility and try again later.');return}
        onAccepted()
      } catch {setError('Connection failed. Please retry.')} finally {setBusy(false)}
    }}>
      <label>My current location<select name="country" required className="support-input"><option value="">Choose your location</option><option value="IN">India</option><option value="US">United States</option></select></label>
      <label className="flex gap-3"><input type="checkbox" required/>I am 18 or older and using DocRAG for professional or business purposes.</label>
      <label className="flex gap-3"><input type="checkbox" required/>I will submit only non-sensitive documents and questions that I have permission to share.</label>
      <label className="flex gap-3"><input type="checkbox" required/>I understand and consent to the external AI processing and application retention described above.</label>
      <button className="mono-primary-action" disabled={busy}>{busy?'Saving…':'Accept and continue'}</button>
      {error&&<p role="alert">{error}</p>}
    </form>
  </section>
}
