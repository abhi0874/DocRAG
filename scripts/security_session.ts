import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {getAuth} from '../lib/auth'
import {pool} from '../lib/db'

async function main(){
  assert.match(new URL(process.env.OLLAMA_DATABASE_URL!).pathname,/^\/docrag_security_test_[a-f0-9]{12}$/)
  // Exercise the actual framework's secure-cookie generation, not a mocked flag.
  process.env.DOCRAG_APP_ORIGIN='https://docrag.example.test'
  process.env.DOCRAG_LOCAL_HTTP='false'
  const account=JSON.parse(readFileSync('.local/security-test-accounts.json','utf8'))[0]
  const headers={'Content-Type':'application/json',Origin:'https://docrag.example.test'}
  const auth=getAuth()
  const response=await auth.handler(new Request('https://docrag.example.test/api/auth/sign-in/email',{
    method:'POST',headers,body:JSON.stringify({email:account.email,password:account.password}),
  }))
  assert.equal(response.status,200)
  const cookies=response.headers.getSetCookie()
  assert.ok(cookies.length)
  for(const value of cookies){
    assert.match(value,/; Secure/i);assert.match(value,/; HttpOnly/i)
    assert.match(value,/; SameSite=Lax/i);assert.match(value,/; Path=\//i)
    assert.doesNotMatch(value,/; Domain=/i)
  }
  const cookie=cookies.map(value=>value.split(';')[0]).join('; ')
  const session=await auth.api.getSession({headers:new Headers({cookie}),query:{disableCookieCache:true,disableRefresh:true}})
  assert.equal(session?.user.id,account.id)
  const lifetime=session!.session.expiresAt.getTime()-session!.session.createdAt.getTime()
  assert.ok(lifetime>7.99*3600000 && lifetime<=8*3600000)
  const logout=await auth.handler(new Request('https://docrag.example.test/api/auth/sign-out',{
    method:'POST',headers:{...headers,cookie},body:'{}',
  }))
  assert.equal(logout.status,200)
  assert.equal(await auth.api.getSession({headers:new Headers({cookie}),query:{disableCookieCache:true,disableRefresh:true}}),null)
  console.log('PASS: actual HTTPS Secure/HttpOnly/SameSite/path cookie, eight-hour lifetime and logout replay')
}
main().catch(()=>{console.error('HTTPS session verification failed');process.exitCode=1}).finally(()=>pool.end())
