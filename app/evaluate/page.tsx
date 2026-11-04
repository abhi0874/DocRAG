import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getAuth} from '@/lib/auth'
import { AppHeader } from '@/components/app-header'
import { EvaluationPanel } from '@/components/evaluation-panel'

export default async function EvaluatePage() {
  if(!await getAuth().api.getSession({headers:await headers(),query:{disableCookieCache:true,disableRefresh:true}}))redirect('/sign-in')
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1">
        <EvaluationPanel />
      </main>
    </div>
  )
}
