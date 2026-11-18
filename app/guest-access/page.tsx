import {headers} from 'next/headers'
import {notFound, redirect} from 'next/navigation'
import {getAuth} from '@/lib/auth'
import {registrationTerms} from '@/lib/registration-terms'
import {hostedWorkspace} from '@/lib/workspace-storage'
import {AppHeader} from '@/components/app-header'
import {GuestTerms} from '@/components/signup-terms'

export const dynamic = 'force-dynamic'

export default async function Page() {
  if (!hostedWorkspace()) notFound()
  const requestHeaders = await headers()
  if (await getAuth().api.getSession({headers:requestHeaders})) redirect('/workspace/hosted-ai')
  if (registrationTerms(requestHeaders)) redirect('/')
  return <div className="app-frame"><AppHeader enhanced/>
    <main id="main-content" className="mx-auto max-w-2xl px-5 py-8"><GuestTerms/></main></div>
}
