import {demoEnabled} from '@/lib/demo-config'
import {DemoWorkspace} from '@/components/demo-workspace'
export const dynamic='force-dynamic'
import { AppHeader } from '@/components/app-header'
import { Workspace } from '@/components/workspace'

export default function Page() {
  return (
    <div className="app-frame">
      <AppHeader />
      {demoEnabled() ? <DemoWorkspace /> : <Workspace />}
    </div>
  )
}
