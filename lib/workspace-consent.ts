import {createHmac, timingSafeEqual} from 'node:crypto'
import {demoEnabled} from './demo-config'
import {workspaceEnabled} from './workspace-config'
import {HttpError} from './security/http'

export const consentVersion = 'non-sensitive-professional-v1'
export const consentCookie = 'docrag_processing_consent'
// Expanding the initial audience requires a provider-terms review.
export const eligibleCountries = ['IN', 'US'] as const
const lifetime = 8 * 60 * 60
function signature(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('Consent signing key unavailable')
  return createHmac('sha256', secret).update(`consent:${value}`).digest('base64url')
}
export function consentToken(country: string, now = Date.now()) {
  if (!eligibleCountries.some(c => c === country)) throw new HttpError(403, 'Hosted AI is not available in your region')
  const payload = Buffer.from(JSON.stringify({version: consentVersion, country, expires: Math.floor(now / 1000) + lifetime})).toString('base64url')
  return `${payload}.${signature(payload)}`
}
export function requireProcessingConsent(req: Request, now = Date.now()) {
  if (!workspaceEnabled() || !demoEnabled()) return
  const value = req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${consentCookie}=`))?.slice(consentCookie.length + 1)
  if (!value || value.length > 1024) throw new HttpError(403, 'Review and accept the hosted AI privacy limits first')
  const [payload, signed, extra] = value.split('.')
  if (!payload || !signed || extra) throw new HttpError(403, 'Processing consent expired; review the privacy limits')
  const expected = signature(payload)
  if (signed.length !== expected.length || !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))) throw new HttpError(403, 'Processing consent is invalid')
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.version !== consentVersion || !eligibleCountries.includes(data.country) || !Number.isInteger(data.expires) || data.expires <= now / 1000 || data.expires > now / 1000 + lifetime) throw new Error('invalid')
  } catch { throw new HttpError(403, 'Processing consent expired; review the privacy limits') }
}
