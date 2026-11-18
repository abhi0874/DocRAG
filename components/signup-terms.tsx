'use client'
import {useRouter} from 'next/navigation'
import {ProcessingConsent} from './processing-consent'

export function SignupTerms({local}: {local: boolean}) {
  const router = useRouter()
  return <ProcessingConsent local={local} registering onAccepted={() => router.refresh()}/>
}

export function GuestTerms() {
  const router = useRouter()
  return <ProcessingConsent onAccepted={() => router.replace('/')}/>
}
