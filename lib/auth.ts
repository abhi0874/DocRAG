import {registrationTerms} from './registration-terms'
import {betterAuth} from 'better-auth'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {db} from './db'
import * as schema from './db/security-schema'
import {workspaceEnabled} from './workspace-config'
import {googleCredentials} from './google-auth'

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
  const google = googleCredentials()
  return betterAuth({
    appName:'DocRAG', baseURL:config.origin, secret,
    database:drizzleAdapter(db,{provider:'pg',schema,transaction:true}),
    socialProviders: google ? {google: {
      ...google, disableImplicitSignUp:true, accessType:'online', includeGrantedScopes:false,
    }} : {},
    account:{accountLinking:{enabled:false},updateAccountOnSignIn:false},
    user:{additionalFields:{
      consentVersion:{type:'string',required:false,input:false,returned:false},
      consentCountry:{type:'string',required:false,input:false,returned:false},
      consentAcceptedAt:{type:'date',required:false,input:false,returned:false},
      hostedAiEnabled:{type:'boolean',required:false,input:false,returned:false},
    }},
    databaseHooks:{user:{create:{before:async (user, ctx) => {
      if (!workspaceEnabled()) return
      const terms = registrationTerms(ctx?.request?.headers ?? ctx?.headers)
      if (!terms) return false
      return {data:{...user, ...terms}}
    }}},account:{create:{before:async account => {
      if (account.providerId === 'google') {
        return {data:{...account, accessToken:null, refreshToken:null, idToken:null,
          accessTokenExpiresAt:null, refreshTokenExpiresAt:null}}
      }
    }}}},
    onAPIError:{errorURL:config.origin+'/sign-in'},
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
