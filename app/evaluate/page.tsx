import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getAuth} from '@/lib/auth'
import {demoEnabled} from '@/lib/demo-config'
import { AppHeader } from '@/components/app-header'
import { EvaluationPanel } from '@/components/evaluation-panel'

export const dynamic = 'force-dynamic'

export default async function EvaluatePage() {
  if(!await getAuth().api.getSession({headers:await headers(),query:{disableCookieCache:true,disableRefresh:true}}))redirect('/sign-in')
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main id="main-content" className="flex-1">
        <EvaluationPanel demoMode={demoEnabled()} />
      </main>
    </div>
  )
}
