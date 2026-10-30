import {afterEach, describe, expect, it, vi} from 'vitest'
import {ResponseCache, responseKey, stableHash, type CacheIdentity} from '@/lib/response-cache'
import {validateCitations} from '@/lib/citations'
import {publicCacheScope} from '@/lib/public-cache-policy'
import manifest from '@/lib/public-cache-manifest.json'
import type {DocumentSnapshot} from '@/lib/evidence'

const identity: CacheIdentity = {question: 'What?', scope: 'public', documentId: 3, documentHash: 'a', context: [{id: 1, content: 'a'}],
  retrieval: {rrf: 60}, reranker: {enabled: false}, model: {digest: 'fixed', options: {temperature: 0}}, prompt: {version: 'v1'}, history: []}
afterEach(() => vi.unstubAllEnvs())
it('hashes object key order consistently without collapsing significant whitespace', () => {
  expect(stableHash({b: 1,a: 2})).toBe(stableHash({a: 2,b: 1}))
  expect(responseKey({...identity, question: ' What? '})).toBe(responseKey(identity))
  expect(responseKey({...identity, question: 'What  now?'})).not.toBe(responseKey({...identity, question: 'What now?'}))
})
it.each(['scope','documentId','documentHash','context','retrieval','reranker','model','prompt','history'] as const)('invalidates changed %s', field => {
  expect(responseKey({...identity, [field]: 'changed'})).not.toBe(responseKey(identity))
})
it('separates model digest and generation settings', () => {
  for (const model of [{digest: 'other', options: {temperature: 0}}, {digest: 'fixed', options: {temperature: 1}}])
    expect(responseKey({...identity, model})).not.toBe(responseKey(identity))
})
it('hits only same scope, expires, and invalidates deleted documents', () => {
  let now = 1; const c = new ResponseCache(2, 1000, 10, () => now)
  c.set('a','public',3,{text:'answer',tokens:5})
  expect(c.get('a','other')).toBeUndefined(); expect(c.get('a','public')?.text).toBe('answer')
  now = 11; expect(c.get('a','public')).toBeUndefined()
  c.set('a','public',3,{text:'answer',tokens:5}); c.invalidateDocument(3); expect(c.size).toBe(0)
})
it('evicts least recently used entries and enforces byte bounds', () => {
  const c = new ResponseCache(2,1000)
  for (const key of ['a','b']) c.set(key,'public',3,{text:key,tokens:1})
  c.get('a','public');c.set('c','public',3,{text:'c',tokens:1})
  expect(c.get('b','public')).toBeUndefined();expect(c.size).toBe(2)
  expect(c.set('huge','public',3,{text:'x'.repeat(1000),tokens:1})).toBe(false)
})
it('bounds concurrent owners and prevents duplicate writes by callers', () => {
  const c = new ResponseCache(1)
  expect(c.acquire('a')).toBe(true);expect(c.acquire('a')).toBe(false);expect(c.acquire('b')).toBe(false)
  c.release('a'); expect(c.acquire('b')).toBe(true)
})
it('rejects invalid IDs and adjacent duplicate citations without claiming support', () => {
  expect(validateCitations('Fact [1][2].',2)).toMatchObject({valid:true,semanticSupport:'not-verified'})
  for (const text of ['Fact [0].','Fact [3].','Fact [1][1].','']) expect(validateCitations(text,2).valid).toBe(false)
  expect(validateCitations('Available excerpts do not establish this.',2).valid).toBe(true)
})
describe('public cache eligibility', () => {
  const messages = [{id:'m', role:'user' as const, parts:[{type:'text' as const,text:'In FastAPI, what Python value does item_id: int receive for /items/3?'}]}]
  const snapshot = {document:{id:manifest.documents[0]?.id},hash:manifest.documents[0]?.hash} as DocumentSnapshot
  it('defaults off and never trusts client ownership flags', () => {
    expect(publicCacheScope(snapshot,messages)).toBeNull()
    vi.stubEnv('RESPONSE_CACHE_ENABLED','true');vi.stubEnv('AI_PROVIDER','ollama');vi.stubEnv('DOCRAG_CHUNKING_EXPERIMENT',manifest.experiment)
    expect(publicCacheScope(snapshot,messages)).toBe(manifest.scope)
    expect(publicCacheScope({...snapshot,hash:'private'},messages)).toBeNull()
    expect(publicCacheScope(snapshot,[...messages,...messages])).toBeNull()
    expect(publicCacheScope(snapshot,[{...messages[0],parts:[{type:'text',text:'Private question about me'}]}])).toBeNull()
    vi.stubEnv('AI_PROVIDER','gemini');expect(publicCacheScope(snapshot,messages)).toBeNull()
  })
})
