import {betterAuth} from 'better-auth'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {db} from './db'
import * as schema from './db/security-schema'
import {workspaceEnabled} from './workspace-config'

export function appOrigin() {
  const url = new URL(process.env.DOCRAG_APP_ORIGIN || 'http://localhost:8000')
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid application origin')
  const local = process.env.DOCRAG_LOCAL_HTTP === 'true' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('HTTPS required')
  return {origin:url.origin, host:url.host, secure:!local || url.protocol === 'https:'}
}
function createAuth() {
  const config=appOrigin(), secret=process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32 || secret.includes('replace-')) throw new Error('Authentication secret is not configured')
  return betterAuth({
    appName:'DocRAG', baseURL:config.origin, secret,
    database:drizzleAdapter(db,{provider:'pg',schema,transaction:true}),
    emailAndPassword:{enabled:true,disableSignUp:!workspaceEnabled(),autoSignIn:false,minPasswordLength:12,maxPasswordLength:128},
    session:{expiresIn:8*60*60,disableSessionRefresh:true,cookieCache:{enabled:false}},
    trustedOrigins:[config.origin],
    advanced:{useSecureCookies:config.secure,ipAddress:{ipAddressHeaders:[]},
      defaultCookieAttributes:{httpOnly:true,sameSite:'lax',path:'/',secure:config.secure}},
    // All HTTP auth calls use our atomic database quota; no untrusted forwarded IP.
    rateLimit:{enabled:false}, logger:{disabled:true},
  })
}
let instance:ReturnType<typeof createAuth>|undefined
export function getAuth(){return instance ??= createAuth()}
