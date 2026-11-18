'use client'
import {AuthStatus} from './auth-status'
import {AppearanceControl} from './appearance'
import {ArrowUpRight,Layers2} from 'lucide-react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
export function AppHeader({enhanced=false}:{enhanced?:boolean}={}){
 const pathname=usePathname()
 return <header className="app-header">
  <Link href="/" className="brand" aria-label="DocRAG home"><span className="brand-symbol"><Layers2 size={21} strokeWidth={1.4}/></span><span>DocRAG<span className="brand-edition">MONO / GLASS</span></span></Link>
  <nav className="main-navigation" aria-label="Main">{(enhanced?[['/','Guest Demo'],['/workspace','My Workspace'],['/sign-up','Sign Up']]:[['/','Workspace'],['/evaluate','Evaluation'],['/metrics/dashboard','Insights']]).map(([href,label])=><Link key={href} href={href} aria-current={pathname===href?'page':undefined}>{label}{pathname===href&&<span className="nav-dot" aria-hidden="true"/>}</Link>)}</nav>
  <div className="header-tools"><span className="header-caption">AN OPTICAL WORKSPACE <ArrowUpRight size={12}/></span><AppearanceControl/><AuthStatus/></div>
 </header>
}
