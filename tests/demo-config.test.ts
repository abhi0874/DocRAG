import {afterEach,describe,expect,it,vi} from 'vitest'
import {demoSettings,demoDatabaseUrl,demoApiKey,normalizeDemoEmbedding,demoEnabled} from '../lib/demo-config'
import {demoGoogle} from '../lib/demo-provider'
import {allowedDemoQuestion} from '../lib/demo-policy'
import {streamText} from 'ai'
const enable=()=>{vi.stubEnv('DOCRAG_DEPLOYMENT','recruiter-demo');vi.stubEnv('AI_PROVIDER','gemini');vi.stubEnv('RERANKER_ENABLED','false');vi.stubEnv('RESPONSE_CACHE_ENABLED','false')}
afterEach(()=>vi.unstubAllEnvs())
describe('cloud configuration and billing boundary',()=>{
 it('leaves local mode opt-in',()=>{vi.stubEnv('DOCRAG_DEPLOYMENT','local');expect(demoEnabled()).toBe(false)})
 it('rejects unknown modes',()=>{vi.stubEnv('DOCRAG_DEPLOYMENT','typo');expect(()=>demoEnabled()).toThrow()})
 it('requires explicit Gemini',()=>{enable();vi.stubEnv('AI_PROVIDER','ollama');expect(()=>demoSettings()).toThrow()})
 it('pins reviewed defaults and disables retries',()=>{enable();expect(demoSettings()).toMatchObject({model:'gemini-3.5-flash-lite',maxRetries:0,maxOutputTokens:1024})})
 it('rejects unreviewed models',()=>{enable();vi.stubEnv('GEMINI_CHAT_MODEL','gemini-3.8-live');expect(()=>demoSettings()).toThrow()})
 it('rejects cache enablement',()=>{enable();vi.stubEnv('RESPONSE_CACHE_ENABLED','true');expect(()=>demoSettings()).toThrow()})
 it('rejects absent billing confirmation before reading credentials',()=>{enable();vi.stubEnv('DOCRAG_GEMINI_BILLING_CONFIRMED','');expect(()=>demoApiKey()).toThrow('billing')})
 it('does not fall back to legacy keys',()=>{enable();vi.stubEnv('DOCRAG_GEMINI_BILLING_CONFIRMED','no-linked-account');vi.stubEnv('GEMINI_API_KEY','');vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY','fake-only-key');expect(()=>demoApiKey()).toThrow('key')})
 it('requires a separate database',()=>{enable();vi.stubEnv('DEMO_DATABASE_URL','postgresql://127.0.0.1:55433/docrag_ollama_v1');expect(()=>demoDatabaseUrl()).toThrow()})
 it('allows explicit loopback fixtures without expanding remote database access',()=>{
  enable();vi.stubEnv('DOCRAG_POSTGRES_PORT','55433');vi.stubEnv('DOCRAG_LOCAL_HTTP','true');vi.stubEnv('DOCRAG_WORKSPACE_TEST_DATABASE','true')
  vi.stubEnv('DEMO_DATABASE_URL','postgresql://127.0.0.1:55433/docrag_security_test_012345abcdef');expect(demoDatabaseUrl()).toContain('docrag_security_test_')
  vi.stubEnv('DEMO_DATABASE_URL','postgresql://example.neon.tech/docrag_security_test_012345abcdef?sslmode=verify-full');expect(()=>demoDatabaseUrl()).toThrow()
  vi.stubEnv('DEMO_DATABASE_URL','postgresql://127.0.0.1:55433/docrag_security_test_012345abcdef');vi.stubEnv('DOCRAG_WORKSPACE_TEST_DATABASE','false');expect(()=>demoDatabaseUrl()).toThrow()
 })
 it('rejects remote unverified TLS',()=>{enable();vi.stubEnv('DEMO_DATABASE_URL','postgresql://example.neon.tech/docrag_demo_gemini_v1?sslmode=require');expect(()=>demoDatabaseUrl()).toThrow()})
 it('accepts verified TLS and exact dedicated database',()=>{enable();vi.stubEnv('DEMO_DATABASE_URL','postgresql://example.neon.tech/docrag_demo_gemini_v1?sslmode=verify-full');expect(demoDatabaseUrl()).toContain('verify-full')})
 it('rejects foreign 768-dimensional vectors',()=>{expect(()=>normalizeDemoEmbedding(Array(768).fill(1))).toThrow()})
 it('rejects nonfinite and zero vectors',()=>{expect(()=>normalizeDemoEmbedding(Array(1536).fill(0))).toThrow();expect(()=>normalizeDemoEmbedding(Array(1536).fill(NaN))).toThrow()})
 it('normalizes cloud vectors',()=>{expect(Math.hypot(...normalizeDemoEmbedding(Array(1536).fill(2)))).toBeCloseTo(1)})
 it('rejects private documents and arbitrary conversation before inference',()=>{
  const snapshot={isPublic:false,hash:'unknown',document:{id:3,title:'',filename:'',status:'ready'},chunks:[]}
  expect(allowedDemoQuestion(snapshot,[{id:'a',role:'user',parts:[{type:'text',text:'private'}]}])).toBe(false)
  expect(allowedDemoQuestion({...snapshot,isPublic:true},[])).toBe(false)
 })
 it('billing gate prevents even mocked transport from being reached',async()=>{
  enable();vi.stubEnv('DOCRAG_GEMINI_BILLING_CONFIRMED','');const transport=vi.fn<typeof fetch>()
  const result=streamText({model:demoGoogle(transport)(demoSettings().model),prompt:'public',maxRetries:0})
  const parts=[];for await(const p of result.stream)parts.push(p)
  expect(parts.some(p=>p.type==='error')).toBe(true);expect(transport).not.toHaveBeenCalled()
 })
 it.each([429,500,503])('does not retry provider HTTP %i',async status=>{
  enable();vi.stubEnv('DOCRAG_GEMINI_BILLING_CONFIRMED','no-linked-account');vi.stubEnv('GEMINI_API_KEY','synthetic-test-key-not-a-credential')
  const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error:{code:status,message:'mock failure',status:'RESOURCE_EXHAUSTED'}}),{status,headers:{'content-type':'application/json'}}))
  const result=streamText({model:demoGoogle(transport)(demoSettings().model),prompt:'public',maxRetries:0})
  for await(const p of result.stream){void p}
  expect(transport).toHaveBeenCalledTimes(1)
  expect(transport.mock.calls[0][1]?.redirect).toBe('error')
 })
})

describe('mocked Gemini streaming protocol',()=>{
 const prepare=()=>{enable();vi.stubEnv('DOCRAG_GEMINI_BILLING_CONFIRMED','no-linked-account');vi.stubEnv('GEMINI_API_KEY','synthetic-test-key-not-a-credential')}
 it('preserves text citations and usage through the installed SDK',async()=>{
  prepare()
  const body='data: '+JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'Public answer [1].'}]},finishReason:'STOP',index:0}],usageMetadata:{promptTokenCount:8,candidatesTokenCount:5,totalTokenCount:13}})+'\n\n'
  const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(body,{headers:{'content-type':'text/event-stream'}}))
  const result=streamText({model:demoGoogle(transport)(demoSettings().model),prompt:'public',maxRetries:0})
  const parts=[];for await(const p of result.stream)parts.push(p)
  expect(parts.filter(p=>p.type==='text-delta').map(p=>p.text).join('')).toBe('Public answer [1].')
  expect(parts.some(p=>p.type==='finish'&&p.finishReason==='stop')).toBe(true)
  expect(transport).toHaveBeenCalledTimes(1)
 })
 it('passes cancellation to transport without retry',async()=>{
  prepare();const abort=new AbortController()
  const transport=vi.fn<typeof fetch>(async(_input,init)=>{
    expect(init?.signal).toBeTruthy();abort.abort()
    throw new DOMException('Cancelled','AbortError')
  })
  const result=streamText({model:demoGoogle(transport)(demoSettings().model),prompt:'public',maxRetries:0,abortSignal:abort.signal})
  for await(const p of result.stream){void p}
  expect(transport).toHaveBeenCalledTimes(1)
 })
})
