import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {GET, POST} from '@/app/api/auth/[...all]/route'
import {getAuth} from '@/lib/auth'
import {consentCookie, consentToken} from '@/lib/registration-terms'
import {consumeLimit} from '@/lib/security/limits'
import {HttpError} from '@/lib/security/http'

const rows=vi.hoisted(()=>({user:[] as Record<string,unknown>[],account:[] as Record<string,unknown>[],session:[],verification:[]}))
vi.mock('better-auth/adapters/drizzle',async()=>{
  const {memoryAdapter}=await import('better-auth/adapters/memory')
  return {drizzleAdapter:()=>memoryAdapter(rows)}
})
vi.mock('@/lib/db',()=>({db:{}}))
vi.mock('@/lib/security/limits',()=>({consumeLimit:vi.fn(async()=>{})}))
vi.mock('@/lib/observability/persist',()=>({persistMetric:vi.fn(async()=>true)}))

const origin='https://studio.example.test'
const email='google-user@example.test'
function post(path:string,body:unknown,cookie='',requestOrigin=origin) {
  return POST(new Request(origin+'/api/auth/'+path,{method:'POST',
    headers:{'Content-Type':'application/json',Origin:requestOrigin,cookie},body:JSON.stringify(body)}))
}
function cookieHeader(response:Response) {
  return response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
}
async function start(intent:'sign-in'|'sign-up') {
  return post('google/start',{intent},consentCookie+'='+consentToken('IN'))
}
async function finish(started:Response,withTerms=true) {
  expect(started.status).toBe(200)
  const target=new URL((await started.json()).url)
  const callback=new URL('/api/auth/callback/google',origin)
  callback.searchParams.set('state',target.searchParams.get('state')!)
  callback.searchParams.set('code','synthetic-provider-code')
  return GET(new Request(callback,{headers:{cookie:cookieHeader(started)+(withTerms?'; '+consentCookie+'='+consentToken('CA'):'')}}))
}
describe('Google workspace authentication',()=>{
  beforeAll(async()=>{
    vi.stubEnv('DOCRAG_APP_ORIGIN',origin)
    vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','true')
    vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo')
    vi.stubEnv('BETTER_AUTH_SECRET',randomUUID()+randomUUID())
    vi.stubEnv('GOOGLE_CLIENT_ID','local-test-client')
    vi.stubEnv('GOOGLE_CLIENT_SECRET',randomUUID())
    const google=(await getAuth().$context).socialProviders.find(p=>p.id==='google')!
    // Only Google's external identity exchange is simulated. Better Auth verifies
    // browser state and creates the account and session through its real handlers.
    vi.spyOn(google,'validateAuthorizationCode').mockResolvedValue({accessToken:'fixture-access',idToken:'fixture-id',refreshToken:'fixture-refresh'})
    vi.spyOn(google,'getUserInfo').mockResolvedValue({
      user:{email,emailVerified:true,name:'Test reader'},data:{sub:'synthetic-subject'},
    })
  })
  beforeEach(()=>{
    Object.values(rows).forEach(table=>{table.length=0})
    vi.clearAllMocks()
  })
  afterAll(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()})

  it('generates a fixed Google redirect with state, PKCE and identity-only scopes',async()=>{
    const response=await start('sign-in')
    expect(response.status).toBe(200)
    const body=await response.json()
    expect(Object.keys(body)).toEqual(['url'])
    const url=new URL(body.url)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('redirect_uri')).toBe(origin+'/api/auth/callback/google')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual(['email','openid','profile'])
    expect(cookieHeader(response)).toBeTruthy()
  })
  it('requires consent for registration and applies existing caps before Google',async()=>{
    expect((await post('google/start',{intent:'sign-up'})).status).toBe(403)
    expect(consumeLimit).not.toHaveBeenCalledWith('registrationDay','global')
    await start('sign-up')
    expect(consumeLimit).toHaveBeenCalledWith('registrationDay','global')
    expect(consumeLimit).toHaveBeenCalledWith('registrationTotal','global')
    vi.mocked(consumeLimit).mockRejectedValueOnce(new HttpError(429,'Too many attempts',60))
    expect((await start('sign-in')).status).toBe(429)
  })
  it('restricts initiation to the configured same-origin Google flow',async()=>{
    expect((await post('google/start',{intent:'sign-in'},'','https://elsewhere.example.test')).status).toBe(403)
    expect((await post('google/start',{intent:'sign-in',callbackURL:'/elsewhere'})).status).toBe(400)
    expect((await post('sign-in/social',{provider:'google'})).status).toBe(404)
    expect((await GET(new Request(origin+'/api/auth/callback/other'))).status).toBe(404)
    const saved=process.env.GOOGLE_CLIENT_SECRET
    try {
      vi.stubEnv('GOOGLE_CLIENT_SECRET','')
      expect((await start('sign-in')).status).toBe(404)
      expect((await GET(new Request(origin+'/api/auth/callback/google'))).status).toBe(404)
    } finally {vi.stubEnv('GOOGLE_CLIENT_SECRET',saved)}
    vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','false')
    try {expect((await start('sign-in')).status).toBe(404)}
    finally {vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','true')}
  })
  it('returns a generic failure for an incomplete callback without a session',async()=>{
    const response=await GET(new Request(origin+'/api/auth/callback/google?error=access_denied'))
    expect(response.headers.get('location')).toBe(origin+'/sign-in?google=failed')
    expect(cookieHeader(response)).toBe('')
    expect(rows.session).toHaveLength(0)
  })
  it('requires the browser that initiated the Google authorization',async()=>{
    const started=await start('sign-up')
    const state=new URL((await started.json()).url).searchParams.get('state')!
    const callback=new URL('/api/auth/callback/google',origin)
    callback.searchParams.set('state',state)
    callback.searchParams.set('code','synthetic-provider-code')
    const response=await GET(new Request(callback))
    expect(response.headers.get('location')).toBe(origin+'/sign-in?google=failed')
    expect(rows.user).toHaveLength(0)
    expect(rows.session).toHaveLength(0)
  })
  it('does not implicitly register a new Google identity at sign-in',async()=>{
    expect((await finish(await start('sign-in'))).headers.get('location')).toBe(origin+'/sign-in?google=failed')
    expect(rows.user).toHaveLength(0)
  })
  it('registers once, keeps no provider tokens, signs in again, and invalidates the session on sign-out',async()=>{
    const registered=await finish(await start('sign-up'))
    expect(registered.headers.get('location')).toBe(origin+'/workspace')
    expect(rows.user[0]).toMatchObject({consentCountry:'CA',hostedAiEnabled:true})
    expect(rows.account).toHaveLength(1)
    expect(rows.account[0]).toMatchObject({providerId:'google',accountId:'synthetic-subject',accessToken:null,refreshToken:null,idToken:null})
    const again=await finish(await start('sign-in'),false)
    expect(again.headers.get('location')).toBe(origin+'/workspace')
    const cookie=cookieHeader(again)
    const session=()=>GET(new Request(origin+'/api/auth/get-session',{headers:{cookie}}))
    const result=await (await session()).json()
    expect(result.user.email).toBe(email)
    expect(Object.keys(result).sort()).toEqual(['expiresAt','user'])
    expect(Math.abs(Date.parse(result.expiresAt)-Date.now()-8*3600_000)).toBeLessThan(5000)
    expect(rows.user).toHaveLength(1)
    expect((await post('sign-out',{},cookie)).status).toBe(200)
    expect(await (await session()).json()).toBeNull()
  })
  it('rejects new Google registration when the acceptance expires during OAuth',async()=>{
    const response=await finish(await start('sign-up'),false)
    expect(response.headers.get('location')).toBe(origin+'/sign-in?google=failed')
    expect(rows.user).toHaveLength(0)
  })
  it('keeps an existing password account separate when the email matches',async()=>{
    expect((await post('sign-up/email',{name:'Email reader',email,password:randomUUID()},consentCookie+'='+consentToken('IN'))).status).toBe(200)
    const response=await finish(await start('sign-up'))
    expect(response.headers.get('location')).toBe(origin+'/sign-in?google=failed')
    expect(rows.user).toHaveLength(1)
    expect(rows.account.map(account=>account.providerId)).toEqual(['credential'])
    expect(rows.session).toHaveLength(0)
  })
})
