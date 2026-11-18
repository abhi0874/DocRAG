import SignIn from '@/components/sign-in-form'
import {workspaceEnabled} from '@/lib/workspace-config'
import {googleCredentials} from '@/lib/google-auth'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{google?:string|string[]}>}){
  return <SignIn enhanced={workspaceEnabled()} googleEnabled={Boolean(googleCredentials())}
    googleFailed={(await searchParams).google==='failed'}/>
}
