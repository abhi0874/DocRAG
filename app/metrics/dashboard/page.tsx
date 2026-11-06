import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getAuth} from '@/lib/auth'
import {AppHeader} from '@/components/app-header'
import {MetricsDashboard} from '@/components/metrics-dashboard'
export const dynamic = 'force-dynamic'

export default async function MetricsPage(){
  if(!await getAuth().api.getSession({headers:await headers(),query:{disableCookieCache:true,disableRefresh:true}}))redirect('/sign-in')
  return <div className="min-h-dvh"><AppHeader/><MetricsDashboard/></div>
}
