import {notFound} from 'next/navigation'
import {UILab} from '@/components/ui-lab'
export const dynamic = 'force-dynamic'
export default function Page() {
  // No production fixture route or authentication bypass. This is a
  // local development presentation harness; it never calls the model or database.
  if (process.env.NODE_ENV !== 'development') notFound()
  return <UILab/>
}
