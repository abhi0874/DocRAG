import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { localChat, localEmbeddings, ollamaRequest, verifyLocalModels, validateEmbeddingVectors } from '../lib/ollama'
import { localSettings } from '../lib/provider-config'
import { selectContext } from '../lib/select-context'
import { closeRerankers } from '../lib/reranker-client'
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
  if (input.uncachedRetrieval || target.pathname !== '/api/embed') return originalFetch(request)
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
  if (!['answer', 'retrieve', 'profile', 'plans'].includes(input.action)) throw new Error('Unknown local evaluation action')
  const {hybridSearch} = await import('../lib/rag')
  const {startRagAnswer} = await import('../lib/rag-answer')
  const {answerInstructions} = await import('../lib/rag-prompt')
  const {consumeAnswer} = await import('./consume-answer')
  const {pool} = await import('../lib/db')
  try {
    if (input.action === 'profile') {
      const rows = []
      for (let repetition = 0; repetition < input.repetitions; repetition++) {
        for (const request of input.requests) {
          let timing
          const selection = input.config.reranking ? await selectContext(request.question, request.documentId,
            10, input.config.reranking, input.config.retrieval, value => {timing = value}) : undefined
          const ranked = selection?.ranked ?? await hybridSearch(request.question, request.documentId, input.topK ?? 10, input.config.retrieval,
            value => {timing = value})
          rows.push({id: request.id, repetition, ranked, timing, selection})
        }
      }
      return {rows, cache_condition: input.uncachedRetrieval ? 'fresh query embeddings; warm persistent SQL pool after first query' : 'evaluation cache enabled'}
    }
    if (input.action === 'plans') {
      const {searchStatements} = await import('../lib/retrieval')
      const {PgDialect} = await import('drizzle-orm/pg-core')
      const {sql} = await import('drizzle-orm')
      const embedding = (await localEmbeddings([input.question], 'query')).embeddings[0]
      const statements = searchStatements(input.question, input.documentId, embedding, input.config.retrieval)
      const client = await pool.connect()
      try {
        await client.query('BEGIN READ ONLY')
        const plans: Record<string, unknown> = {}
        for (const [name, statement] of Object.entries(statements)) {
          const query = new PgDialect().sqlToQuery(sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`)
          plans[name] = (await client.query(query.sql, query.params)).rows[0]['QUERY PLAN']
        }
        return plans
      } finally {await client.query('ROLLBACK'); client.release()}
    }
    const start = performance.now()
    let timing
    const selection = input.config.reranking ? await selectContext(input.question, input.documentId,
      10, input.config.reranking, input.config.retrieval, value => {timing = value}) : undefined
    const ranked = selection?.ranked ?? await hybridSearch(input.question, input.documentId, input.topK ?? 10, input.config.retrieval,
      value => {timing = value})
    const retrievalMs = performance.now() - start
    if (input.action === 'retrieve') return {ranked, retrieval_latency_ms: retrievalMs, cache: stats, timing, selection}
    let retrieved = ranked.slice(0, 6)
    const version = input.config.prompting_experiment ?? 'step5-v1'
    if (input.config.prompting_experiment) {
      const {documentSnapshot, withEvidenceMetadata} = await import('../lib/evidence')
      const snapshot = await documentSnapshot(input.documentId)
      if (!snapshot) throw new Error('Evaluation document unavailable')
      retrieved = withEvidenceMetadata(retrieved, snapshot)
    }
    const instructions = answerInstructions(retrieved, version)
    const messages = [{id: 'evaluation', role: 'user' as const, parts: [{type: 'text' as const, text: input.question}]}]
    const cacheInput = {provider: 'ollama', settings: localSettings(), instructions, messages, config: input.config,
      ...(selection ? {candidates: selection.candidates, selected: ranked, reranking: selection.trace.status} : {})}
    const path = `${directory}/answer-${hash(cacheInput)}.json`
    const generationStart = performance.now()
    let answer
    if (existsSync(path)) {
      answer = JSON.parse(readFileSync(path, 'utf8'))
      if (answer.finish_reason !== 'stop' || !answer.text?.trim()) throw new Error('Invalid cached local answer')
      stats.answer_hits++
    } else {
      stats.answer_misses++
      const stream = await startRagAnswer(messages, retrieved, version)
      const result = await consumeAnswer(stream)
      if (result.finishReason !== 'stop' || !result.text.trim()) throw new Error('Incomplete local answer')
      answer = {text: result.text, usage: result.usage, finish_reason: result.finishReason, original_generation_latency_ms: performance.now() - generationStart, generated_at: new Date().toISOString()}
      save(path, answer)
    }
    return {ranked, answer, timing, selection, cache: stats, embedding_usage: embeddingUsage, retrieval_latency_ms: retrievalMs,
      generation_latency_ms: performance.now() - generationStart, total_latency_ms: performance.now() - start, pacing_ms: 0}
  } finally {closeRerankers(); await pool.end()}
}
main().then(result => process.stdout.write(JSON.stringify(result))).catch(error => {
  let detail = error instanceof Error ? error.message : 'Unknown local error'
  for (const name of ['DATABASE_URL', 'OLLAMA_DATABASE_URL', 'GOOGLE_GENERATIVE_AI_API_KEY']) {
    const value = process.env[name]; if (value) detail = detail.split(value).join('[REDACTED]')
  }
  detail = detail.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\r\n]+/g, ' ')
  process.stderr.write(`Evaluation adapter failed: ${detail}\n`); process.exitCode = 1
})
