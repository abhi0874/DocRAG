import type { LanguageModel } from 'ai'
import { localSettings } from './provider-config'

type Model = Extract<LanguageModel, { specificationVersion: 'v4' }>
type Options = Parameters<Model['doGenerate']>[0]
type StreamPart = Awaited<ReturnType<Model['doStream']>>['stream'] extends ReadableStream<infer T> ? T : never
export type OllamaMessage = { role: string; content: string }
export type OllamaResult = {
  model: string; message: { content: string }; done: boolean; done_reason: string;
  prompt_eval_count: number; eval_count: number; prompt_eval_duration?: number;
  eval_duration?: number; total_duration?: number; load_duration?: number;
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function ollamaRequest(path: string, body?: unknown, signal?: AbortSignal) {
  if (!['/api/tags', '/api/show', '/api/version', '/api/ps', '/api/embed', '/api/chat'].includes(path)) throw new Error('Unsupported local API endpoint')
  const config = localSettings()
  for (let attempt = 0; attempt < config.max_attempts; attempt++) {
    try {
      const response = await fetch(config.baseUrl + path, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(config.timeout_ms)]) : AbortSignal.timeout(config.timeout_ms),
      })
      if (!response.ok) {
        // Never include credentials, provider URLs or arbitrary response bodies.
        if ((response.status === 429 || response.status >= 500) && attempt < config.max_attempts - 1) {
          await response.body?.cancel(); await sleep(1000 * 2 ** attempt); continue
        }
        throw new Error(`Local Ollama HTTP ${response.status}`)
      }
      return response
    } catch (error) {
      if (signal?.aborted || attempt === config.max_attempts - 1 || !(error instanceof TypeError)) throw error
      await sleep(1000 * 2 ** attempt)
    }
  }
  throw new Error('Local Ollama retries exhausted')
}

export async function verifyLocalModels() {
  const config = localSettings()
  const tags = await (await ollamaRequest('/api/tags')).json() as { models: Array<{ name: string; digest: string; details?: unknown; remote_host?: string }> }
  for (const [name, digest] of [[config.chat, config.chatDigest], [config.embedding, config.embeddingDigest]]) {
    const model = tags.models.find(m => m.name === name)
    if (!model || model.digest !== digest || model.remote_host) throw new Error('Installed local model identity/digest mismatch')
  }
  return tags.models.filter(m => [config.chat, config.embedding].includes(m.name))
}

export function validateEmbeddingVectors(vectors: unknown, count: number, dimensions: number): asserts vectors is number[][] {
  if (!Array.isArray(vectors) || vectors.length !== count || vectors.some(v => !Array.isArray(v) || v.length !== dimensions
    || v.some(n => typeof n !== 'number' || !Number.isFinite(n)))) throw new Error('Invalid local embedding count/dimensions/values')
}

export async function localEmbeddings(contents: string[], task: 'document' | 'query') {
  if (!contents.length) return { embeddings: [] as number[][], prompt_eval_count: 0 }
  await verifyLocalModels()
  const c = localSettings()
  const response = await (await ollamaRequest('/api/embed', {
    model: c.embedding, input: contents.map(s => (task === 'document' ? c.document_prefix : c.query_prefix) + s),
    truncate: false, keep_alive: c.keep_alive,
  })).json()
  validateEmbeddingVectors(response.embeddings, contents.length, c.embeddingDimensions)
  if (response.model !== c.embedding) throw new Error('Unexpected embedding model')
  return response as { embeddings: number[][]; prompt_eval_count?: number }
}

function chatBody(messages: OllamaMessage[], stream: boolean, format?: unknown) {
  const c = localSettings()
  return { model: c.chat, messages, stream, think: c.think, options: c.options, keep_alive: c.keep_alive, ...(format ? {format} : {}) }
}

export function validateCompletion(r: OllamaResult) {
  if (!r.done || r.done_reason !== 'stop' || !r.message?.content?.trim()) throw new Error('Incomplete/empty local generation; not cacheable')
  if (r.model !== localSettings().chat) throw new Error('Unexpected local answer model')
  if (![r.prompt_eval_count, r.eval_count].every(x => Number.isInteger(x) && x >= 0)) throw new Error('Invalid local token counts')
  if (r.prompt_eval_count + localSettings().options.num_predict > localSettings().options.num_ctx) throw new Error('Local context budget exceeded')
  return r
}

export async function localChat(messages: OllamaMessage[], format?: unknown, signal?: AbortSignal) {
  await verifyLocalModels()
  return validateCompletion(await (await ollamaRequest('/api/chat', chatBody(messages, false, format), signal)).json())
}

function convertPrompt(options: Options): OllamaMessage[] {
  if (options.tools?.length) throw new Error('DocRAG local adapter supports text only')
  return options.prompt.map(message => {
    if (message.role === 'system') return {role: message.role, content: message.content}
    if (message.role === 'tool') throw new Error('Tool messages unsupported by local text adapter')
    const parts = message.content.map(p => {
      if (p.type !== 'text') throw new Error('Local adapter requires text messages')
      return p.text
    })
    return {role: message.role, content: parts.join('')}
  })
}
function usage(r: OllamaResult) {
  return {inputTokens: {total: r.prompt_eval_count, noCache: undefined, cacheRead: undefined, cacheWrite: undefined},
    outputTokens: {total: r.eval_count, text: r.eval_count, reasoning: 0}}
}

export function ollamaLanguageModel(): Model {
  return {
    specificationVersion: 'v4', provider: 'ollama.local', modelId: localSettings().chat, supportedUrls: {},
    async doGenerate(options) {
      const r = await localChat(convertPrompt(options), undefined, options.abortSignal)
      return {content: [{type: 'text', text: r.message.content}], finishReason: {unified: 'stop', raw: r.done_reason}, usage: usage(r), warnings: []}
    },
    async doStream(options) {
      await verifyLocalModels()
      const response = await ollamaRequest('/api/chat', chatBody(convertPrompt(options), true), options.abortSignal)
      if (!response.body) throw new Error('Missing local response stream')
      const body = response.body
      return {stream: new ReadableStream<StreamPart>({
        async start(controller) {
          const reader = body.pipeThrough(new TextDecoderStream()).getReader()
          let buffer = '', text = '', finished = false
          controller.enqueue({type: 'stream-start', warnings: []})
          controller.enqueue({type: 'text-start', id: 'answer'})
          const accept = (line: string) => {
            if (!line.trim()) return
            const r = JSON.parse(line)
            if (r.error) throw new Error('Local generation stream failed')
            const delta = r.message?.content || ''
            text += delta
            if (delta) controller.enqueue({type: 'text-delta', id: 'answer', delta})
            if (r.done) {
              validateCompletion({...r, message: {content: text}})
              finished = true
              controller.enqueue({type: 'text-end', id: 'answer'})
              controller.enqueue({type: 'finish', usage: usage(r), finishReason: {unified: 'stop', raw: r.done_reason}})
            }
          }
          try {
            for (;;) {
              const r = await reader.read()
              if (r.done) break
              buffer += r.value
              let end: number
              while ((end = buffer.indexOf('\n')) >= 0) {accept(buffer.slice(0, end)); buffer = buffer.slice(end + 1)}
            }
            accept(buffer)
            if (!finished) throw new Error('Interrupted local generation stream')
            controller.close()
          } catch (error) {controller.error(error)} finally {await reader.cancel().catch(() => {}); reader.releaseLock()}
        },
      })}
    },
  }
}
