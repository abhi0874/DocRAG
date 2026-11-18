import {eq} from 'drizzle-orm'
import {z} from 'zod'
import {db} from './db'
import {user} from './db/security-schema'
import {demoEnabled} from './demo-config'
import {workspaceEnabled} from './workspace-config'
import {HttpError} from './security/http'

import {eligibleCountry} from './eligible-countries'
import {registrationTerms} from './registration-terms'
import {consentVersion} from './processing-policy'
export {consentVersion}
export const acceptance = z.object({
  version: z.literal(consentVersion), country: z.string().refine(eligibleCountry), adult: z.literal(true), professional: z.literal(true),
  nonSensitive: z.literal(true), externalProcessing: z.literal(true),
}).strict()

export async function accountConsent(owner: string) {
  const [row] = await db.select({
    version: user.consentVersion, country: user.consentCountry,
    acceptedAt: user.consentAcceptedAt, allowed: user.hostedAiEnabled,
  }).from(user).where(eq(user.id, owner))
  if (!row) throw new HttpError(401, 'Sign in required')
  const accepted = row.version === consentVersion && !!row.acceptedAt && acceptance.shape.country.safeParse(row.country).success
  return {enabled: accepted && row.allowed, accepted, version: row.version, country: row.country, acceptedAt: row.acceptedAt}
}

export async function requireProcessingConsent(owner: string | null, headers: Headers) {
  if (!workspaceEnabled() || !demoEnabled()) return
  if (!owner) {
    if (!registrationTerms(headers)) throw new HttpError(403, 'Review hosted AI access before sending questions.')
    return
  }
  if (!(await accountConsent(owner)).enabled) throw new HttpError(403, 'Review hosted AI access in your workspace before sending questions or documents.')
}
