import {afterEach, expect, it, vi} from 'vitest'
import {databaseConnection, localSettings, ollamaBaseUrl, providerName} from '../lib/provider-config'
import {localChat, localEmbeddings, ollamaLanguageModel, validateCompletion, validateEmbeddingVectors, verifyLocalModels} from '../lib/ollama'
const c = localSettings()
const tags = {models: [{name: c.chat, digest: c.chatDigest}, {name: c.embedding, digest: c.embeddingDigest}]}
const complete = {model: c.chat, message: {content: 'Supported answer. [1]'}, done: true, done_reason: 'stop', prompt_eval_count: 20, eval_count: 5}
afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals()})
it('defaults to Gemini and rejects unknown provider names', () => {
  vi.stubEnv('AI_PROVIDER', ''); expect(providerName()).toBe('gemini')
  vi.stubEnv('AI_PROVIDER', 'ollama'); expect(providerName()).toBe('ollama')
  vi.stubEnv('AI_PROVIDER', 'typo'); expect(providerName).toThrow()
})
it('rejects remote endpoints and credentials before any network access', () => {
  for (const value of ['https://ollama.com', 'http://localhost:11434@evil.test', 'http://user:secret@localhost:11434', 'http://localhost:11434/path']) {
    vi.stubEnv('OLLAMA_BASE_URL', value); expect(ollamaBaseUrl).toThrow()
  }
})
it('cannot select a Gemini database for local vectors', () => {
  vi.stubEnv('AI_PROVIDER','ollama'); vi.stubEnv('OLLAMA_DATABASE_URL','')
  expect(databaseConnection).toThrow()
  vi.stubEnv('OLLAMA_DATABASE_URL','postgresql://local@127.0.0.1:55432/docrag_dev')
  expect(databaseConnection).toThrow()
  vi.stubEnv('OLLAMA_DATABASE_URL','postgresql://local@127.0.0.1:55432/docrag_ollama_v1')
  expect(databaseConnection()).toContain('/docrag_ollama_v1')
})
it('rejects wrong dimensionality, nonfinite vectors and missing vectors', () => {
  for (const v of [[], [[1]], [[NaN,2]], [[Infinity,2]], [['1',2]]]) expect(() => validateEmbeddingVectors(v,1,2)).toThrow()
  expect(() => validateEmbeddingVectors([[1,2]],1,2)).not.toThrow()
})
it('checks the installed digest and rejects cloud models', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({models:[{name:c.chat,digest:'changed'}]})))
  await expect(verifyLocalModels()).rejects.toThrow('digest')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({models:tags.models.map(m=>({...m,remote_host:'cloud'}))})))
  await expect(verifyLocalModels()).rejects.toThrow('digest')
})
it('uses only local embeddings with distinct document/query prefixes and no truncation', async () => {
  const requests: Record<string,unknown>[]=[]
  vi.stubGlobal('fetch',vi.fn(async (url:string, init:RequestInit) => {
    expect(url.startsWith('http://localhost:11434/')).toBe(true)
    if (url.endsWith('/api/tags')) return Response.json(tags)
    const body=JSON.parse(init.body as string);requests.push(body)
    return Response.json({model:c.embedding,embeddings:[Array(768).fill(0.1)],prompt_eval_count:4})
  }))
  await localEmbeddings(['Evidence'],'document'); await localEmbeddings(['Question'],'query')
  expect(requests.map(x=>x.input)).toEqual([[c.document_prefix+'Evidence'],[c.query_prefix+'Question']])
  expect(requests.every(x=>x.truncate===false)).toBe(true)
})
it('rejects empty, interrupted and output-limit completions', () => {
  for (const r of [{...complete,done:false},{...complete,done_reason:'length'},{...complete,message:{content:''}},{...complete,prompt_eval_count:32768}]) expect(()=>validateCompletion(r)).toThrow()
})
it('preserves explicit local settings, citations and reported tokens', async () => {
  let body: Record<string,unknown>={}
  vi.stubGlobal('fetch',vi.fn(async (url:string, init:RequestInit) => {
    if(url.endsWith('/api/tags')) return Response.json(tags)
    body=JSON.parse(init.body as string); return Response.json(complete)
  }))
  const r=await localChat([{role:'user',content:'Question'}],'json')
  expect(body.options).toEqual(c.options);expect(body.think).toBe(false)
  expect(r.message.content).toContain('[1]');expect(r.eval_count).toBe(5)
})
it('a stream interrupted after partial text never finishes successfully', async () => {
  vi.stubGlobal('fetch',vi.fn(async (url:string) => url.endsWith('/api/tags') ? Response.json(tags) : new Response(JSON.stringify({message:{content:'Partial text'},done:false})+'\n')))
  const result=await ollamaLanguageModel().doStream({prompt:[{role:'user',content:[{type:'text',text:'Q'}]}]})
  const reader=result.stream.getReader()
  const read=async()=>{for(;;){const r=await reader.read();if(r.done)break}}
  await expect(read()).rejects.toThrow('Interrupted')
})
