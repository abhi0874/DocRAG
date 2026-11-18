import {observed} from '@/lib/observability/http'
import {z} from 'zod'
import {appOrigin,getAuth} from '@/lib/auth'
import {googleCredentials} from '@/lib/google-auth'
import {checkOrigin,jsonBody,safeError,HttpError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
import {createHmac} from 'node:crypto'
import {workspaceEnabled} from '@/lib/workspace-config'
import {requireProcessingConsent} from '@/lib/workspace-consent'
const credentials=z.object({email:z.email().max(254),password:z.string().min(1).max(128)}).strict()
const registration=credentials.extend({name:z.string().trim().min(1).max(80),password:z.string().min(12).max(128)}).strict()
const googleIntent=z.object({intent:z.enum(['sign-in','sign-up'])}).strict()

async function limitRegistration() {
  await consumeLimit('registrationDay','global')
  await consumeLimit('registrationTotal','global')
}

async function startGoogle(req:Request) {
  const {intent}=await jsonBody(req,googleIntent,256)
  if(intent==='sign-up') {
    requireProcessingConsent(req)
    await limitRegistration()
  }
  const {origin}=appOrigin()
  const result=await getAuth().api.signInSocial({
    headers:req.headers, asResponse:true,
    body:{provider:'google', requestSignUp:intent==='sign-up', disableRedirect:true,
      callbackURL:origin+'/workspace', errorCallbackURL:origin+'/sign-in'},
  })
  if(!result.ok) throw new HttpError(503,'Google sign-in is unavailable')
  const {url}=await result.json()
  const target=new URL(url)
  if(target.origin!=='https://accounts.google.com' || target.pathname!=='/o/oauth2/v2/auth')
    throw new HttpError(503,'Google sign-in is unavailable')
  const headers=new Headers({'Cache-Control':'no-store'})
  for(const cookie of result.headers.getSetCookie()) headers.append('Set-Cookie',cookie)
  return Response.json({url:target.href},{headers})
}

async function finishGoogle(req:Request) {
  await consumeLimit('auth',null)
  const {origin,host}=appOrigin()
  if((req.headers.get('host') ?? new URL(req.url).host)!==host) throw new HttpError(403,'Request host is not allowed')
  // Google returns by top-level navigation. Better Auth validates state, its browser cookie and PKCE.
  const response=await getAuth().handler(req)
  const location=response.headers.get('location')
  const success=response.status>=300 && response.status<400 && location===origin+'/workspace'
  const headers=new Headers({'Location':origin+(success?'/workspace':'/sign-in?google=failed'),
    'Cache-Control':'no-store','Referrer-Policy':'no-referrer'})
  if(success) for(const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie',cookie)
  return new Response(null,{status:303,headers})
}

async function handlePOST(req:Request) {
  try {
    checkOrigin(req)
    await consumeLimit('auth',null)
    const path=new URL(req.url).pathname
    if(path==='/api/auth/google/start' && googleCredentials()) return await startGoogle(req)
    const signup=path==='/api/auth/sign-up/email' && workspaceEnabled()
    if(!signup && !['/api/auth/sign-in/email','/api/auth/sign-out'].includes(path)) throw new HttpError(404,'Operation unavailable')
    if(signup) requireProcessingConsent(req)
    const body:Record<string,unknown>=await jsonBody(req,signup ? registration : path.endsWith('/sign-out') ? z.object({}).strict() : credentials,4096)
    if('email' in body && typeof body.email==='string') {
      const secret=process.env.BETTER_AUTH_SECRET
      if(!secret || secret.length<32) throw new Error('Authentication unavailable')
      await consumeLimit('authAccount',createHmac('sha256',secret).update(body.email.trim().toLowerCase()).digest('hex'))
    }
    if(signup) await limitRegistration()
    const clean=new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(body)})
    const response=await getAuth().handler(clean)
    if(!response.ok) return Response.json({error:'Authentication failed'},{status:response.status,headers:{'Cache-Control':'no-store'}})
    // Never expose the framework's raw session token in a JSON body.
    const headers=new Headers(response.headers)
    headers.delete('Content-Length');headers.set('Cache-Control','no-store')
    return Response.json({ok:true},{status:response.status,headers})
  } catch(error){return safeError(error)}
}
async function handleGET(req:Request) {
  try {
    const path=new URL(req.url).pathname
    if(path==='/api/auth/callback/google' && googleCredentials()) return await finishGoogle(req)
    if(path!=='/api/auth/get-session') throw new HttpError(404,'Operation unavailable')
    await consumeLimit('read',null)
    const session=await getAuth().api.getSession({headers:req.headers,query:{disableCookieCache:true,disableRefresh:true}})
    return Response.json(session ? {user:{id:session.user.id,name:session.user.name,email:session.user.email},expiresAt:session.session.expiresAt}:null,
      {headers:{'Cache-Control':'no-store'}})
  } catch(error){return safeError(error)}
}

export const GET=observed('/api/auth/:operation',handleGET)
export const POST=observed('/api/auth/:operation',handlePOST)
