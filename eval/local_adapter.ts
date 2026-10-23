import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { localChat, localEmbeddings, ollamaRequest, verifyLocalModels, validateEmbeddingVectors } from '../lib/ollama'
import { localSettings } from '../lib/provider-config'
const input = JSON.parse(readFileSync(0, 'utf8'))
const directory = '.local/ollama-cache/runtime'
mkdirSync(directory, {recursive: true})
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
function save(path: string, data: unknown) {const temp = `${path}.${process.pid}.tmp`; writeFileSync(temp, JSON.stringify(data)); renameSync(temp, path)}
const stats = {embedding_hits: 0, embedding_misses: 0, answer_hits: 0, answer_misses: 0}
let embeddingUsage: unknown = null
const originalFetch = globalThis.fetch
// Evaluation process rejects every nonlocal network request, including redirects.
globalThis.fetch = async (url, init) => {
  const request = new Request(url, init)
  const target = new URL(request.url)
  if (target.origin !== localSettings().baseUrl) throw new Error('Nonlocal model request forbidden in Ollama evaluation')
  if (target.pathname !== '/api/embed') return originalFetch(request)
  const body = await request.clone().text()
  const key = hash({provider: 'ollama', body, config: input.config, settings: localSettings()})
  const path = `${directory}/embedding-${key}.json`
  if (existsSync(path)) {
    stats.embedding_hits++
    const cached = JSON.parse(readFileSync(path, 'utf8'))
    embeddingUsage = {totalTokens: cached.prompt_eval_count ?? null}
    return Response.json(cached)
  }
  stats.embedding_misses++
  const response = await originalFetch(request)
  if (response.ok) {
    const result = await response.clone().json()
    const count = JSON.parse(body).input.length
    validateEmbeddingVectors(result.embeddings, count, localSettings().embeddingDimensions)
    if (result.model !== localSettings().embedding) throw new Error('Embedding response model mismatch')
    save(path, result); embeddingUsage = {totalTokens: result.prompt_eval_count ?? null}
  }
  return response
}
async function main() {
  const models = await verifyLocalModels()
  if (input.action === 'metadata') {
    return {models, version: await (await ollamaRequest('/api/version')).json(), settings: localSettings()}
  }
  if (input.action === 'embed') return localEmbeddings(input.contents, 'document')
  if (input.action === 'judge') {
    const start = performance.now()
    const result = await localChat([{role: 'user', content: input.prompt}], 'json')
    return {text: result.message.content, usage: {totalTokens: result.prompt_eval_count + result.eval_count, inputTokens: result.prompt_eval_count, outputTokens: result.eval_count}, latency_ms: performance.now() - start, finish_reason: result.done_reason}
  }
  if (input.action !== 'answer') throw new Error('Unknown local evaluation action')
  const {hybridSearch, buildContext, RAG_INSTRUCTIONS} = await import('../lib/rag')
  const {startRagAnswer} = await import('../lib/rag-answer')
  const {consumeAnswer} = await import('./consume-answer')
  const {pool} = await import('../lib/db')
  try {
    const start = performance.now()
    const ranked = await hybridSearch(input.question, input.documentId, 10)
    const retrievalMs = performance.now() - start
    const retrieved = ranked.slice(0, 6)
    const instructions = `${RAG_INSTRUCTIONS}\n\nContext excerpts:\n\n${buildContext(retrieved)}`
    const messages = [{id: 'evaluation', role: 'user' as const, parts: [{type: 'text' as const, text: input.question}]}]
    const path = `${directory}/answer-${hash({provider: 'ollama', settings: localSettings(), instructions, messages, config: input.config})}.json`
    const generationStart = performance.now()
    let answer
    if (existsSync(path)) {
      answer = JSON.parse(readFileSync(path, 'utf8'))
      if (answer.finish_reason !== 'stop' || !answer.text?.trim()) throw new Error('Invalid cached local answer')
      stats.answer_hits++
    } else {
      stats.answer_misses++
      const stream = await startRagAnswer(messages, retrieved)
      const result = await consumeAnswer(stream)
      if (result.finishReason !== 'stop' || !result.text.trim()) throw new Error('Incomplete local answer')
      answer = {text: result.text, usage: result.usage, finish_reason: result.finishReason, original_generation_latency_ms: performance.now() - generationStart, generated_at: new Date().toISOString()}
      save(path, answer)
    }
    return {ranked, answer, cache: stats, embedding_usage: embeddingUsage, retrieval_latency_ms: retrievalMs,
      generation_latency_ms: performance.now() - generationStart, total_latency_ms: performance.now() - start, pacing_ms: 0}
  } finally {await pool.end()}
}
main().then(result => process.stdout.write(JSON.stringify(result))).catch(error => {
  let detail = error instanceof Error ? error.message : 'Unknown local error'
  for (const name of ['DATABASE_URL', 'OLLAMA_DATABASE_URL', 'GOOGLE_GENERATIVE_AI_API_KEY']) {
    const value = process.env[name]; if (value) detail = detail.split(value).join('[REDACTED]')
  }
  detail = detail.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\r\n]+/g, ' ')
  process.stderr.write(`Evaluation adapter failed: ${detail}\n`); process.exitCode = 1
})
