'use client'
import {useState} from 'react'
import {useSWRConfig} from 'swr'
import {ProfileAvatar, thumbnail} from './profile-avatar'

export function ProfileForm({initialName, initialAvatar, email}: {initialName: string; initialAvatar: string | null; email: string}) {
  const [name, setName] = useState(initialName), [avatar, setAvatar] = useState(initialAvatar)
  const [saved, setSaved] = useState({name: initialName, avatar: initialAvatar})
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const {mutate} = useSWRConfig()
  return <form className="glass-surface grid grid-cols-1 gap-4 rounded-2xl p-6" onSubmit={async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/account', {method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name: name.trim(), avatar})})
      if (!response.ok) throw new Error()
      setSaved({name: name.trim(), avatar}); setName(name.trim()); setNotice('Profile saved.')
      await mutate('/api/auth/get-session')
    } catch {setNotice('Could not confirm the update. Refresh your profile and try again.')}
    finally {setBusy(false)}
  }}>
    <h2 className="text-xl font-semibold">Personal details</h2>
    <div className="flex flex-wrap items-center gap-4"><ProfileAvatar pixels={avatar} name={name}/>
      <div className="min-w-0 max-w-full"><label className="support-field">Profile picture
        <input className="max-w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
          onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''
            if (!file) return
            setBusy(true); setNotice('')
            try {setAvatar(await thumbnail(file))}
            catch {setNotice('Choose a readable JPEG, PNG or WebP image up to 4 MB.')}
            finally {setBusy(false)}
          }}/>
      </label>{avatar && <button type="button" className="text-sm underline" disabled={busy}
        onClick={() => {setAvatar(null);setNotice('')}}>Remove picture</button>}</div>
    </div>
    <label className="support-field">Display name<input required maxLength={80} className="support-input"
      autoComplete="nickname" value={name} disabled={busy} onChange={e => {setName(e.target.value);setNotice('')}}/></label>
    <p className="break-words text-sm text-muted-foreground">Signed in as {email}</p>
    <button className="support-action justify-self-start" disabled={busy || !name.trim() || (name.trim()===saved.name && avatar===saved.avatar)}>Save profile</button>
    <p role="status" aria-live="polite">{notice}</p>
  </form>
}
