import {createHmac, timingSafeEqual} from 'node:crypto'
import {eligibleCountry} from './eligible-countries'
import {demoEnabled} from './demo-config'
import {consentVersion, localTermsVersion} from './processing-policy'

export const consentCookie = 'docrag_registration_terms'
export const consentLifetime = 8 * 60 * 60
function signature(payload: string) {
  const key = process.env.BETTER_AUTH_SECRET
  if (!key || key.length < 32) throw new Error('Consent signing key unavailable')
  return createHmac('sha256', key).update('registration-terms:' + payload).digest('base64url')
}
export function consentToken(country: string | null, now = Date.now()) {
  if (demoEnabled() ? !eligibleCountry(country) : country !== null) throw new Error('Invalid country for these terms')
  const payload = Buffer.from(JSON.stringify({country, version: demoEnabled() ? consentVersion : localTermsVersion, at: now})).toString('base64url')
  return payload + '.' + signature(payload)
}
export function registrationTerms(headers: Headers | undefined, now = Date.now()) {
  const token = headers?.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(consentCookie+'='))?.slice(consentCookie.length+1)
  if (!token || token.length > 512) return null
  const [payload, mac, ...extra] = token.split('.')
  const expected = signature(payload)
  if (extra.length || !mac || !/^[A-Za-z0-9_-]{43}$/.test(mac) || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
  try {
    const {country, version, at} = JSON.parse(Buffer.from(payload,'base64url').toString())
    if (version !== (demoEnabled() ? consentVersion : localTermsVersion) ||
        (demoEnabled() ? !eligibleCountry(country) : country !== null) ||
        !Number.isSafeInteger(at) || at > now || now - at >= consentLifetime * 1000) return null
    return {consentCountry: country as string | null, consentVersion: version as string, consentAcceptedAt: new Date(at), hostedAiEnabled: demoEnabled()}
  } catch {return null}
}
