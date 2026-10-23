// Calls the real retrieval and shared chat generation. Runs only in evaluation.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { generationPacer } from './request-pacing'
import { consumeAnswer } from './consume-answer'

const input = JSON.parse(readFileSync(0, 'utf8')) as {
  action: 'answer' | 'judge'; config: Record<string, unknown>;
  question?: string; documentId?: number; prompt?: string; judgeModel?: string;
  contextLimit?: number; modelIntervalMs: number;
}
const cacheDir = resolve('.local/eval-cache/runtime')
mkdirSync(cacheDir, { recursive: true })
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const stats = { embedding_hits: 0, embedding_misses: 0, answer_hits: 0, answer_misses: 0 }
// Scheduling does not change a model prompt, result or embedding.
const cacheConfig = { ...input.config }
delete cacheConfig.minimum_model_interval_ms
// Read old keys only when every other input still matches exactly.
const legacyConfig = { ...input.config, minimum_model_interval_ms: 7000 }
let pacingMs = 0
function save(path: string, value: unknown) {
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(value))
  renameSync(temp, path)
}
const pacingPath = `${cacheDir}/last-model-call.json`
const pace = generationPacer({
  intervalMs: input.modelIntervalMs,
  readLast: () => existsSync(pacingPath) ? JSON.parse(readFileSync(pacingPath, 'utf8')).at : 0,
  writeLast: at => save(pacingPath, { at }),
  now: Date.now,
  sleep: ms => new Promise(r => setTimeout(r, ms)),
})

// Cache only actual query-embedding provider responses. SQL retrieval is always fresh.
const originalFetch = globalThis.fetch
globalThis.fetch = async (requestInput, init) => {
  const request = new Request(requestInput, init)
  const url = new URL(request.url)
  const pacingStart = performance.now()
  if (await pace(url)) pacingMs += performance.now() - pacingStart
  if (url.hostname !== 'generativelanguage.googleapis.com' || !url.pathname.endsWith(':embedContent')) {
    return originalFetch(request)
  }
  const body = await request.clone().text()
  const keyInput = { kind: 'query-embedding-v1', path: url.pathname,
    method: request.method, body }
  const key = hash({ ...keyInput, config: cacheConfig })
  const path = `${cacheDir}/embedding-${key}.json`
  const legacyPath = `${cacheDir}/embedding-${hash({ ...keyInput, config: legacyConfig })}.json`
  const readPath = existsSync(path) ? path : legacyPath
  if (existsSync(readPath)) {
    const cached = JSON.parse(readFileSync(readPath, 'utf8')) as { body: string }
    if (readPath !== path) save(path, cached)
    stats.embedding_hits++
    return new Response(cached.body, {status: 200, headers: {'content-type': 'application/json'}})
  }
  stats.embedding_misses++
  const response = await originalFetch(request)
  if (response.ok) {
    const text = await response.clone().text()
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed.embedding?.values)) throw new Error('Invalid embedding response')
    save(path, {body: text})
  }
  return response
}

async function main() {
  if (input.action === 'judge') {
    const {google} = await import('@ai-sdk/google')
    const {generateText, Output} = await import('ai')
    const start = performance.now()
    const result = await generateText({
      model: google(input.judgeModel!), prompt: input.prompt!,
      output: Output.json(),
      maxOutputTokens: 4096, temperature: 0, maxRetries: 2,
      providerOptions: {google: {thinkingConfig: {thinkingLevel: 'minimal'}}},
      abortSignal: AbortSignal.timeout(90000),
    })
    process.stdout.write(JSON.stringify({text: result.text, usage: result.totalUsage,
      latency_ms: performance.now() - start - pacingMs, finish_reason: result.finishReason}))
    return
  }
  if (input.action !== 'answer' || !input.question || !Number.isInteger(input.documentId)) {
    throw new Error('Invalid evaluation request')
  }
  const {hybridSearch, buildContext, RAG_INSTRUCTIONS, CHAT_MODEL} = await import('../lib/rag')
  const {startRagAnswer} = await import('../lib/rag-answer')
  const {pool} = await import('../lib/db')
  try {
    const start = performance.now()
    // topK only slices the existing fused ranking. No new retrieval implementation.
    const ranked = await hybridSearch(input.question, input.documentId!, 10)
    const retrievalMs = performance.now() - start
    const retrieved = ranked.slice(0, 6)
    const messages = [{id: 'evaluation', role: 'user' as const,
      parts: [{type: 'text' as const, text: input.question}]}]
    const context = buildContext(retrieved)
    const keyInput = {kind: 'chat-answer-v1', model: CHAT_MODEL.modelId,
      instructions: `${RAG_INSTRUCTIONS}\n\nContext excerpts:\n\n${context}`,
      messages}
    const key = hash({...keyInput, config: cacheConfig})
    const path = `${cacheDir}/answer-${key}.json`
    const legacyPath = `${cacheDir}/answer-${hash({...keyInput, config: legacyConfig})}.json`
    const readPath = existsSync(path) ? path : legacyPath
    let answer: { text: string; usage: unknown; original_generation_latency_ms: number;
      finish_reason: unknown; generated_at: string }
    let generationMs: number
    if (existsSync(readPath)) {
      const readStart = performance.now()
      answer = JSON.parse(readFileSync(readPath, 'utf8'))
      if (typeof answer.text !== 'string' || !answer.text.trim()) throw new Error('Invalid cached answer')
      if (readPath !== path) save(path, answer)
      generationMs = performance.now() - readStart
      stats.answer_hits++
    } else {
      const pacingBeforeGeneration = pacingMs
      const generationStart = performance.now()
      const stream = await startRagAnswer(messages, retrieved)
      const {text, usage, finishReason} = await consumeAnswer(stream)
      generationMs = performance.now() - generationStart - (pacingMs - pacingBeforeGeneration)
      if (!text.trim()) throw new Error('Empty generated answer')
      answer = {text, usage, original_generation_latency_ms: generationMs,
        finish_reason: finishReason, generated_at: new Date().toISOString()}
      save(path, answer)
      stats.answer_misses++
    }
    process.stdout.write(JSON.stringify({ranked, retrieved, context, answer,
      retrieval_latency_ms: retrievalMs, generation_latency_ms: generationMs,
      total_latency_ms: performance.now() - start - pacingMs,
      pacing_ms: pacingMs, cache: stats}))
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  if (typeof error === 'object' && error !== null && 'lastError' in error) error = error.lastError
  let detail = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error'
  for (const name of ['DATABASE_URL', 'DATABASE_URL_PROD', 'GOOGLE_GENERATIVE_AI_API_KEY']) {
    const value = process.env[name]
    if (value) detail = detail.split(value).join('[REDACTED]')
  }
  detail = detail.replace(/https?:\/\/\S+/g, '[provider URL]').replace(/[\r\n]+/g, ' ')
  process.stderr.write(`Evaluation adapter failed: ${detail}\n`)
  process.exitCode = 1
})
