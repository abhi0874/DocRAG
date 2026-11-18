import {headers} from 'next/headers'
import {registrationTerms} from '@/lib/registration-terms'
import {demoEnabled} from '@/lib/demo-config'
import {SignupTerms} from '@/components/signup-terms'
import {getAuth} from '@/lib/auth'
import {notFound, redirect} from 'next/navigation'
import {workspaceEnabled} from '@/lib/workspace-config'
import {AppHeader} from '@/components/app-header'
import {OpticalPlate} from '@/components/ui/optical-plate'
import {SignUpForm} from '@/components/sign-up-form'
import {googleCredentials} from '@/lib/google-auth'
export const dynamic='force-dynamic'
export default async function Page(){
  if(!workspaceEnabled())notFound()
  const requestHeaders = await headers()
  if (await getAuth().api.getSession({headers:requestHeaders})) redirect('/account')
  const accepted = registrationTerms(requestHeaders)
  return <div className="app-frame"><AppHeader enhanced/><main id="main-content" className="signin-layout signup-layout"><section className="signup-intro"><OpticalPlate/><h2>Your private library.</h2><p>Upload a PDF, ask a question, and read the passage behind the answer.</p></section>{accepted ? <SignUpForm googleEnabled={Boolean(googleCredentials())}/> : <SignupTerms local={!demoEnabled()}/>}</main></div>
}
