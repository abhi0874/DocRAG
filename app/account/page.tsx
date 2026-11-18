import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {AppHeader} from '@/components/app-header'
import {ProfileForm} from '@/components/profile-form'
import {countryName} from '@/lib/eligible-countries'
import {localTermsVersion} from '@/lib/processing-policy'
import {ProcessingTerms, LocalTerms} from '@/components/processing-consent'
import {accountConsent} from '@/lib/workspace-consent'
import {storedAvatar} from '@/lib/profile-avatar'
import {DeleteAccount} from '@/components/delete-account'
import {getAuth} from '@/lib/auth'
import {workspaceEnabled} from '@/lib/workspace-config'

export const dynamic = 'force-dynamic'
export const metadata = {title: 'Profile · DocRAG'}

export default async function AccountPage() {
  const login = await getAuth().api.getSession({
    headers: await headers(), query: {disableCookieCache: true, disableRefresh: true},
  })
  if (!login) redirect('/sign-in')
  const consent = workspaceEnabled() ? await accountConsent(login.user.id) : null
  return <div className="app-frame">
    <AppHeader enhanced={workspaceEnabled()} />
    <main id="main-content" className="account-settings mx-auto w-full max-w-2xl px-5 py-12">
      <h1 className="display-title mb-6 text-4xl">Profile</h1>
      <ProfileForm key={login.user.id} initialName={login.user.name} initialAvatar={storedAvatar(login.user.image)} email={login.user.email}/>
      {consent && <section className="glass-surface mt-6 rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Accepted terms</h2>
        <p className="my-3">{consent.acceptedAt
          ? `Accepted on ${consent.acceptedAt.toISOString().slice(0,10)} (UTC) · ${countryName(consent.country) ?? 'Local workspace'}`
          : 'No account-level acceptance has been recorded.'}</p>
        <details><summary className="cursor-pointer underline">Read the terms</summary>{consent.version===localTermsVersion ? <LocalTerms/> : <ProcessingTerms/>}</details>
      </section>}
      <DeleteAccount key={login.user.id} email={login.user.email} />
    </main>
  </div>
}
