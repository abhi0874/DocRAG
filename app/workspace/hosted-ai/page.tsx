import {headers} from 'next/headers'
import {notFound, redirect} from 'next/navigation'
import {getAuth} from '@/lib/auth'
import {hostedWorkspace} from '@/lib/workspace-storage'
import {AppHeader} from '@/components/app-header'
import {HostedAccessPage} from '@/components/hosted-access'

export const dynamic = 'force-dynamic'

export default async function Page() {
  if (!hostedWorkspace()) notFound()
  if (!await getAuth().api.getSession({headers: await headers()})) redirect('/sign-in')
  return <div className="app-frame"><AppHeader enhanced/>
    <main id="main-content" className="mx-auto grid w-full max-w-2xl gap-4 px-5 py-8">
      <h1 className="display-title text-3xl">Hosted AI access</h1><HostedAccessPage/>
    </main></div>
}
