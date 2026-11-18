import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('@/lib/db',()=>({db:{}}))
import {consentToken,consentCookie,requireProcessingConsent} from '@/lib/workspace-consent'
import {chatInput} from '@/lib/security/http'
import {documentScope} from '@/lib/security/access'
import {sql} from 'drizzle-orm'
import {PgDialect} from 'drizzle-orm/pg-core'
const now=1800000000000
const request=(token?:string)=>new Request('https://example.test/api/chat',{headers:token?{cookie:`${consentCookie}=${token}`}:{}})
beforeEach(()=>{vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','true');vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-secret-for-tests-32-characters')})
afterEach(()=>vi.unstubAllEnvs())
describe('hosted processing consent',()=>{
  it('requires consent before arbitrary text can leave the app',()=>expect(()=>requireProcessingConsent(request(),now)).toThrow('privacy'))
  it.each(['IN','US'])('accepts signed unexpired consent for %s',country=>expect(()=>requireProcessingConsent(request(consentToken(country,now)),now)).not.toThrow())
  it.each(['GB','DE','CH','FR','','XX'])('rejects unsupported country %s',country=>expect(()=>consentToken(country,now)).toThrow())
  it('rejects tampering, extra fields and truncated signatures',()=>{
    const token=consentToken('IN',now)
    for(const bad of [token+'x',token+'.extra',token.slice(0,-3),'forged.token'])expect(()=>requireProcessingConsent(request(bad),now)).toThrow()
  })
  it('expires after eight hours',()=>expect(()=>requireProcessingConsent(request(consentToken('IN',now)),now+28800000)).toThrow('expired'))
  it('does not accept a token after a signing key rotation',()=>{const token=consentToken('IN',now);vi.stubEnv('BETTER_AUTH_SECRET','other-synthetic-key-32-characters-long');expect(()=>requireProcessingConsent(request(token),now)).toThrow()})
  it('leaves local Ollama and the existing sample-only mode unchanged',()=>{
    vi.stubEnv('DOCRAG_DEPLOYMENT','local');expect(()=>requireProcessingConsent(request(),now)).not.toThrow()
    vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo');vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','false');expect(()=>requireProcessingConsent(request(),now)).not.toThrow()
  })
})
describe('multi-document and retention boundaries',()=>{
  const messages=[{id:'q',role:'user',parts:[{type:'text',text:'Compare the recommendations.'}]}]
  it('accepts either the existing single ID or up to three unique IDs',()=>{
    expect(chatInput.safeParse({documentId:1,messages}).success).toBe(true)
    expect(chatInput.safeParse({documentIds:[1,2,3],messages}).success).toBe(true)
  })
  it.each([{}, {documentId:1,documentIds:[2]}, {documentIds:[]}, {documentIds:[1,1]}, {documentIds:[1,2,3,4]}, {documentIds:[-1]}])('rejects ambiguous or unbounded scope %j',scope=>expect(chatInput.safeParse({...scope,messages}).success).toBe(false))
  it('retains ownership and excludes expired uploads from every read scope',()=>{
    const read=new PgDialect().sqlToQuery(documentScope(sql`chunks.document_id`,'account-a'))
    expect(read.sql).toContain('access.owner_id');expect(read.params).toContain('account-a')
    expect(read.sql).toContain('expires_at<=clock_timestamp()')
    expect(read.sql).toContain('p.document_id=chunks.document_id')
    const deletion=new PgDialect().sqlToQuery(documentScope(sql`documents.id`,'account-a',true))
    expect(deletion.sql).not.toContain('expires_at')
    expect(deletion.params).toContain('account-a')
  })
})
