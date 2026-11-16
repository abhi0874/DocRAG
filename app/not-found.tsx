import Link from 'next/link'
import {AppHeader} from '@/components/app-header'
export default function NotFound() {
  return <><AppHeader/><main id="main-content" className="mx-auto max-w-2xl px-6 py-24"><p className="eyebrow">404 / A MISSING PAGE</p><h1 className="display-title mt-5 text-5xl">Let’s get you<br/>back to the source.</h1><p className="my-6 text-muted-foreground">This page could not be found. Your document workspace is one click away.</p><Link className="button-primary" href="/">Return to workspace</Link></main></>
}
