import {notFound} from 'next/navigation'
import {workspaceEnabled} from '@/lib/workspace-config'
import {demoEnabled} from '@/lib/demo-config'
import {AppHeader} from '@/components/app-header'
import {SignUpForm} from '@/components/sign-up-form'
export const dynamic='force-dynamic'
export default function Page(){
  if(!workspaceEnabled())notFound()
  return <div className="app-frame"><AppHeader enhanced/><main id="main-content" className="mx-auto w-full max-w-2xl p-5"><SignUpForm cloud={demoEnabled()}/></main></div>
}
