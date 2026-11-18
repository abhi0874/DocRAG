import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('@/lib/db',()=>({db:{}}))
import {consentToken,consentCookie,registrationTerms} from '@/lib/registration-terms'
import {eligibleCountries} from '@/lib/eligible-countries'
import {acceptance,consentVersion,requireProcessingConsent} from '@/lib/workspace-consent'
import {chatInput} from '@/lib/security/http'
import {documentScope} from '@/lib/security/access'
import {sql} from 'drizzle-orm'
import {PgDialect} from 'drizzle-orm/pg-core'
const now=1800000000000
const receipt=(token?:string,at=now)=>registrationTerms(new Headers(token?{cookie:`${consentCookie}=${token}`}:{}),at)
beforeEach(()=>{vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','true');vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-secret-for-tests-32-characters')})
afterEach(()=>vi.unstubAllEnvs())
describe('hosted processing consent',()=>{
  it('requires consent before guest text can leave the app',async()=>await expect(requireProcessingConsent(null,new Headers())).rejects.toThrow('access'))
  it.each(eligibleCountries)('accepts the listed country $code',({code})=>{
    expect(receipt(consentToken(code,now))?.consentCountry).toBe(code)
    expect(acceptance.safeParse({version:consentVersion,country:code,adult:true,professional:true,nonSensitive:true,externalProcessing:true}).success).toBe(true)
  })
  it.each(['GB','DE','CH','FR','IS','NO','LI','AX','GF','RE','CN','RU','','XX'])('rejects unavailable country %s',country=>expect(()=>consentToken(country,now)).toThrow())
  it('rejects tampering, extra fields and truncated signatures',()=>{
    const token=consentToken('IN',now)
    for(const bad of [token+'x',token+'.extra',token.slice(0,-3),'forged.token'])expect(receipt(bad)).toBeNull()
  })
  it('expires after eight hours',()=>expect(receipt(consentToken('IN',now),now+28800000)).toBeNull())
  it('invalidates unsigned, future, rotated and wrong-environment receipts',()=>{
    expect(receipt()).toBeNull()
    expect(receipt(consentToken('IN',now+1))).toBeNull()
    const token=consentToken('IN',now)
    vi.stubEnv('DOCRAG_DEPLOYMENT','local');expect(receipt(token)).toBeNull()
    vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo')
    vi.stubEnv('BETTER_AUTH_SECRET','other-synthetic-key-32-characters-long');expect(receipt(token)).toBeNull()
  })
  it('leaves local Ollama and existing sample-only requests unchanged',async()=>{
    vi.stubEnv('DOCRAG_DEPLOYMENT','local');await expect(requireProcessingConsent(null,new Headers())).resolves.toBeUndefined()
    vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo');vi.stubEnv('DOCRAG_WORKSPACE_ENABLED','false');await expect(requireProcessingConsent(null,new Headers())).resolves.toBeUndefined()
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
