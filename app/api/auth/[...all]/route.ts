import {observed} from '@/lib/observability/http'
import {z} from 'zod'
import {getAuth} from '@/lib/auth'
import {checkOrigin,jsonBody,safeError,HttpError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
import {createHmac} from 'node:crypto'
import {workspaceEnabled} from '@/lib/workspace-config'
import {requireProcessingConsent} from '@/lib/workspace-consent'
const credentials=z.object({email:z.email().max(254),password:z.string().min(1).max(128)}).strict()
const registration=credentials.extend({name:z.string().trim().min(1).max(80),password:z.string().min(12).max(128)}).strict()
async function handlePOST(req:Request) {
  try {
    checkOrigin(req)
    await consumeLimit('auth',null)
    const path=new URL(req.url).pathname
    const signup=path==='/api/auth/sign-up/email' && workspaceEnabled()
    if(!signup && !['/api/auth/sign-in/email','/api/auth/sign-out'].includes(path)) throw new HttpError(404,'Operation unavailable')
    if(signup) requireProcessingConsent(req)
    const body:Record<string,unknown>=await jsonBody(req,signup ? registration : path.endsWith('/sign-out') ? z.object({}).strict() : credentials,4096)
    if('email' in body && typeof body.email==='string') {
      const secret=process.env.BETTER_AUTH_SECRET
      if(!secret || secret.length<32) throw new Error('Authentication unavailable')
      await consumeLimit('authAccount',createHmac('sha256',secret).update(body.email.trim().toLowerCase()).digest('hex'))
    }
    if(signup) {
      await consumeLimit('registrationDay','global')
      await consumeLimit('registrationTotal','global')
    }
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
    if(new URL(req.url).pathname!=='/api/auth/get-session') throw new HttpError(404,'Operation unavailable')
    await consumeLimit('read',null)
    const session=await getAuth().api.getSession({headers:req.headers,query:{disableCookieCache:true,disableRefresh:true}})
    return Response.json(session ? {user:{id:session.user.id,name:session.user.name,email:session.user.email},expiresAt:session.session.expiresAt}:null,
      {headers:{'Cache-Control':'no-store'}})
  } catch(error){return safeError(error)}
}

export const GET=observed('/api/auth/:operation',handleGET)
export const POST=observed('/api/auth/:operation',handlePOST)
