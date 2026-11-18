import {eq, sql} from 'drizzle-orm'
import {NextResponse} from 'next/server'
import {z} from 'zod'
import {appOrigin, getAuth} from '@/lib/auth'
import {db} from '@/lib/db'
import {consentCookie} from '@/lib/registration-terms'
import {user} from '@/lib/db/security-schema'
import {avatarLength, avatarPrefix, isAvatar} from '@/lib/profile-avatar'
import {observed} from '@/lib/observability/http'
import {responseCache} from '@/lib/response-cache'
import {checkOrigin, HttpError, jsonBody, principal, safeError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'

const confirmation = z.object({email: z.string().trim().min(1).max(254)}).strict()

async function handleDelete(req: Request) {
  try {
    checkOrigin(req)
    const auth = getAuth()
    const login = await auth.api.getSession({
      headers: req.headers, query: {disableCookieCache: true, disableRefresh: true},
    })
    if (!login) throw new HttpError(401, 'Sign in to delete your account.')
    const {email} = await jsonBody(req, confirmation, 1024)
    const owner = login.user.id
    await consumeLimit('auth', owner)
    const {authCookies} = await auth.$context

    const deleted = await db.transaction(async tx => {
      // Lock the parent user against new ownership records and recheck the exact
      // session under lock so a concurrent sign-out or deletion takes effect.
      const {rows: [current]} = await tx.execute<{email: string; fresh: boolean}>(sql`
        SELECT u.email, s.created_at > clock_timestamp() - interval '15 minutes' AS fresh
        FROM auth_user u JOIN auth_session s ON s.user_id = u.id
        WHERE u.id = ${owner} AND s.id = ${login.session.id} AND s.expires_at > clock_timestamp()
        FOR UPDATE OF u, s`)
      if (!current) throw new HttpError(401, 'Sign in to delete your account.')
      if (!current.fresh) throw new HttpError(403, 'Sign in again, then return to Profile to delete your account.')
      if (email.toLowerCase() !== current.email.toLowerCase()) {
        throw new HttpError(400, 'Enter the email address of the signed-in account.')
      }

      const privateDocuments = sql`SELECT document_id FROM document_access
        WHERE owner_id = ${owner} AND visibility = 'private'`
      // Chunks and evaluations predate the foreign keys used by newer tables.
      await tx.execute(sql`DELETE FROM chunks WHERE document_id IN (${privateDocuments})`)
      await tx.execute(sql`DELETE FROM evaluations e WHERE
        EXISTS (SELECT 1 FROM evaluation_access a WHERE a.evaluation_id = e.id AND a.owner_id = ${owner})
        OR (e.document_id IN (${privateDocuments}) AND
            NOT EXISTS (SELECT 1 FROM evaluation_access a WHERE a.evaluation_id = e.id))`)
      const docs = await tx.execute<{id: number}>(sql`DELETE FROM documents
        WHERE id IN (${privateDocuments}) RETURNING id`)
      await tx.execute(sql`DELETE FROM request_limits WHERE key IN (
        SELECT kind || ':' || ${owner} FROM unnest(ARRAY[
          'auth','read','upload','chat','evaluation','feedback','demoUser','workspaceUploadUser'
        ]) AS kind)`)
      // Cascades remove sessions on every device, login methods, private metrics,
      // answer receipts and feedback. Document deletion also cascades to PDF bytes.
      await tx.execute(sql`DELETE FROM auth_user WHERE id = ${owner}`)
      return docs.rows
    })

    for (const {id} of deleted) responseCache.invalidateDocument(id)
    const response = NextResponse.json({ok: true}, {headers: {'Cache-Control': 'no-store'}})
    const expired = {path: '/', httpOnly: true, secure: appOrigin().secure, sameSite: 'lax' as const, maxAge: 0}
    for (const {name} of Object.values(authCookies)) response.cookies.set(name, '', expired)
    response.cookies.set(consentCookie, '', expired)
    return response
  } catch (error) {
    return safeError(error)
  }
}

export const DELETE = observed('/api/account', handleDelete)

const profile = z.object({name: z.string().trim().min(1).max(80),
  avatar: z.string().length(avatarLength).refine(isAvatar).nullable()}).strict()

export const PATCH = observed('/api/account', async (req: Request) => {
  try {
    checkOrigin(req)
    const owner = (await principal(req))!
    await consumeLimit('read', owner)
    const {name, avatar} = await jsonBody(req, profile, avatarLength + 1024)
    const changed = await db.update(user).set({name, image: avatar ? avatarPrefix + avatar : null, updatedAt: new Date()})
      .where(eq(user.id, owner)).returning({id: user.id})
    if (!changed.length) throw new HttpError(401, 'Sign in required')
    return Response.json({ok: true})
  } catch (error) {return safeError(error)}
})
