import SignIn from '@/components/sign-in-form'
import {workspaceEnabled} from '@/lib/workspace-config'
import {googleCredentials} from '@/lib/google-auth'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{google?:string|string[];deleted?:string}>}){
  const query=await searchParams
  return <SignIn enhanced={workspaceEnabled()} googleEnabled={Boolean(googleCredentials())}
    googleFailed={query.google==='failed'} accountDeleted={query.deleted==='1'}/>
}
