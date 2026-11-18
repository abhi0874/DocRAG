import {eq, sql} from 'drizzle-orm'
import {z} from 'zod'
import {appOrigin} from '@/lib/auth'
import {db} from '@/lib/db'
import {user} from '@/lib/db/security-schema'
import {demoEnabled} from '@/lib/demo-config'
import {localTermsVersion} from '@/lib/processing-policy'
import {consentCookie, consentLifetime, consentToken, registrationTerms} from '@/lib/registration-terms'
import {acceptance, accountConsent, consentVersion} from '@/lib/workspace-consent'
import {workspaceEnabled} from '@/lib/workspace-config'
import {checkOrigin, HttpError, jsonBody, principal, safeError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'

const localAcceptance = z.object({version: z.literal(localTermsVersion), accepted: z.literal(true)}).strict()
const disable = z.object({action: z.literal('disable')}).strict()
const headers = {'Cache-Control': 'no-store', Vary: 'Cookie'}

export async function GET(req: Request) {
  try {
    if (!workspaceEnabled()) throw new HttpError(404, 'Operation unavailable')
    const owner = await principal(req, false)
    await consumeLimit('read', owner)
    return Response.json(owner ? {signedIn: true, ...await accountConsent(owner)}
      : {signedIn: false, enabled: !!registrationTerms(req.headers)}, {headers})
  } catch (error) { return safeError(error) }
}

export async function POST(req: Request) {
  try {
    if (!workspaceEnabled()) throw new HttpError(404, 'Operation unavailable')
    checkOrigin(req)
    const owner = await principal(req, false)
    await consumeLimit('read', owner)
    const input = await jsonBody(req, z.union([acceptance, localAcceptance, disable]), 1024)
    if ('action' in input) {
      if (!owner) throw new HttpError(401, 'Sign in required')
      await db.update(user).set({hostedAiEnabled: false}).where(eq(user.id, owner))
    } else {
      if (demoEnabled() !== ('country' in input)) throw new HttpError(400, 'Review the current terms.')
      const country = 'country' in input ? input.country : null
      if (!owner) {
        const cookie = consentCookie+'='+consentToken(country)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+consentLifetime+(appOrigin().secure ? '; Secure' : '')
        return Response.json({ok:true}, {headers:{...headers,'Set-Cookie':cookie}})
      }
      if (!('country' in input)) throw new HttpError(400, 'Hosted AI is unavailable here.')
      // Preserve the original record when enabling this version again.
      const sameVersion = sql`${user.consentVersion} = ${consentVersion}`
      await db.update(user).set({hostedAiEnabled:true, consentVersion,
        consentAcceptedAt:sql`CASE WHEN ${sameVersion} THEN ${user.consentAcceptedAt} ELSE now() END`,
        consentCountry:sql`CASE WHEN ${sameVersion} THEN ${user.consentCountry} ELSE ${country} END`,
      }).where(eq(user.id, owner))
    }
    return Response.json({ok:true}, {headers})
  } catch (error) { return safeError(error) }
}
