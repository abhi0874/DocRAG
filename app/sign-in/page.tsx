import SignIn from '@/components/sign-in-form'
import {workspaceEnabled} from '@/lib/workspace-config'
export const dynamic='force-dynamic'
export default function Page(){return <SignIn enhanced={workspaceEnabled()}/>}
