import {headers} from 'next/headers'
import {notFound,redirect} from 'next/navigation'
import {getAuth} from '@/lib/auth'
import {workspaceEnabled} from '@/lib/workspace-config'
import {demoEnabled} from '@/lib/demo-config'
import {AppHeader} from '@/components/app-header'
import {Workspace} from '@/components/workspace'
export const dynamic='force-dynamic'
export default async function Page(){
  if(!workspaceEnabled())notFound()
  const session=await getAuth().api.getSession({headers:await headers(),query:{disableCookieCache:true,disableRefresh:true}})
  if(!session)redirect('/sign-in')
  return <div className="app-frame"><AppHeader enhanced/><Workspace personal cloud={demoEnabled()} enhanced/></div>
}
