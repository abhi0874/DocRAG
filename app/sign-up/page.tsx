import {notFound} from 'next/navigation'
import {workspaceEnabled} from '@/lib/workspace-config'
import {demoEnabled} from '@/lib/demo-config'
import {AppHeader} from '@/components/app-header'
import {OpticalPlate} from '@/components/ui/optical-plate'
import {SignUpForm} from '@/components/sign-up-form'
export const dynamic='force-dynamic'
export default function Page(){
  if(!workspaceEnabled())notFound()
  return <div className="app-frame"><AppHeader enhanced/><main id="main-content" className="signin-layout signup-layout"><section className="signup-intro"><OpticalPlate/><h2>Your private library.</h2><p>Upload a PDF, ask a question, and read the passage behind the answer.</p></section><SignUpForm cloud={demoEnabled()}/></main></div>
}
