import {z} from 'zod'
import {appOrigin} from '@/lib/auth'
import {workspaceEnabled} from '@/lib/workspace-config'
import {consentCookie, consentToken} from '@/lib/workspace-consent'
import {checkOrigin, HttpError, jsonBody, safeError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'

export async function POST(req: Request) {
  try {
    if (!workspaceEnabled()) throw new HttpError(404, 'Operation unavailable')
    checkOrigin(req)
    await consumeLimit('auth', null)
    const {country} = await jsonBody(req, z.object({country: z.enum(['IN', 'US']), adult: z.literal(true), professional: z.literal(true), nonSensitive: z.literal(true), externalProcessing: z.literal(true)}).strict(), 1024)
    return Response.json({ok: true}, {headers: {'Cache-Control': 'no-store', 'Set-Cookie': `${consentCookie}=${consentToken(country)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${appOrigin().secure ? '; Secure' : ''}`}})
  } catch (error) { return safeError(error) }
}
