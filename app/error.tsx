'use client'
import Link from 'next/link'
export default function ErrorPage({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  return <main id="main-content" className="mx-auto max-w-2xl px-6 py-24"><p className="eyebrow">SOMETHING INTERRUPTED THE CONVERSATION</p><h1 className="display-title mt-5 text-5xl">A moment to<br/>find our footing.</h1><p role="alert" className="my-6 text-muted-foreground">This view could not be loaded. Try again, or return to your workspace.</p><div className="flex flex-wrap gap-3"><button className="button-primary" onClick={reset}>Try again</button><Link className="button-quiet" href="/">Return to workspace</Link></div></main>
}
