import { createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream } from 'ai'
import { selectContext } from '@/lib/select-context'
import { startRagAnswer } from '@/lib/rag-answer'
import { documentSnapshot, withEvidenceMetadata } from '@/lib/evidence'
import { answerInstructions, promptVersion } from '@/lib/rag-prompt'
import { responseCache, responseKey, type CachedAnswer } from '@/lib/response-cache'
import { publicCacheScope, cacheModelIdentity } from '@/lib/public-cache-policy'
import { retrievalDefault } from '@/lib/retrieval-config'
import { rerankerConfig } from '@/lib/reranker-config'
import { validatedStream } from '@/lib/validated-stream'
import { validateCitations } from '@/lib/citations'
import type { RagUIMessage } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: Request) {
  const {messages, documentId}: {messages: RagUIMessage[]; documentId?: number} = await req.json()
  if (!documentId) return Response.json({error: 'No document selected'}, {status: 400})
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const question = lastUser?.parts.filter(p => p.type === 'text').map(p => p.text).join(' ') ?? ''
  const snapshot = await documentSnapshot(documentId)
  if (!snapshot) {responseCache.invalidateDocument(documentId); return Response.json({error: 'Document unavailable'}, {status: 404})}
  const selection = await selectContext(question, documentId, 6)
  const retrieved = withEvidenceMetadata(selection.ranked, snapshot)
  const version = promptVersion()
  const scope = publicCacheScope(snapshot, messages)
  const key = scope ? responseKey({question, scope, documentId, documentHash: snapshot.hash,
    context: retrieved, retrieval: retrievalDefault, reranker: {config: rerankerConfig(), status: selection.trace.status},
    model: await cacheModelIdentity(), prompt: {version, instructions: answerInstructions(retrieved, version)},
    history: messages.map(m => ({role: m.role, parts: m.parts}))}) : null
  // A concurrent edit must not turn a previously eligible snapshot into a stale hit.
  const current = key ? await documentSnapshot(documentId) : snapshot
  if (!current || current.hash !== snapshot.hash) return Response.json({error: 'Document changed; retry'}, {status: 409})
  const hit = key && scope ? responseCache.get(key, scope) : undefined
  const owner = !!(key && !hit && responseCache.acquire(key))
  const status = hit ? 'HIT' : !key ? 'BYPASS' : owner ? 'MISS' : 'BYPASS_BUSY'
  const abort = new AbortController()
  const signal = AbortSignal.any([req.signal, abort.signal])
  let completedAnswer: CachedAnswer | undefined
  const release = () => {if (owner && key) responseCache.release(key)}
  const stream = createUIMessageStream<RagUIMessage>({
    onError: () => {release(); return 'The answer could not be completed. Please retry.'},
    execute: async ({writer}) => {
      writer.write({type: 'data-sources', data: {sources: retrieved}})
      writer.write({type: 'data-cache', data: {status, tokensAvoided: hit?.tokens ?? null}})
      if (hit) {
        writer.write({type: 'start'})
        writer.write({type: 'text-start', id: 'cached-answer'})
        writer.write({type: 'text-delta', id: 'cached-answer', delta: hit.text})
        writer.write({type: 'text-end', id: 'cached-answer'})
        writer.write({type: 'data-validation', data: validateCitations(hit.text, retrieved.length)})
        writer.write({type: 'finish', finishReason: 'stop'})
        return
      }
      try {
        const result = await startRagAnswer(messages, retrieved, version, signal)
        const observed = validatedStream(result.stream, retrieved.length, signal, async answer => {
          completedAnswer = answer
        }, result => writer.write({type: 'data-validation', data: result}), () => {if (!completedAnswer) release()})
        writer.merge(toUIMessageStream({stream: observed}))
      } catch (error) {release(); throw error}
    },
  })
  const response = createUIMessageStreamResponse({stream, headers: {
    'X-DocRAG-Cache': status, 'X-DocRAG-Prompt': version,
    'X-DocRAG-Reranker-Status': selection.trace.status,
    ...(selection.trace.reason ? {'X-DocRAG-Reranker-Reason': selection.trace.reason} : {}),
  }})
  const reader = response.body!.getReader()
  let cancelled = false
  return new Response(new ReadableStream({
    async pull(controller) {
      try {
        const part = await reader.read()
        if (cancelled) return
        if (part.done) {
          // Commit only after the HTTP response body drains, not merely model completion.
          try {
            if (owner && key && scope && completedAnswer && !signal.aborted) {
              const after = await documentSnapshot(documentId)
              if (!signal.aborted && after?.hash === snapshot.hash && publicCacheScope(after, messages) === scope)
                responseCache.set(key, scope, documentId, completedAnswer)
            }
          } finally {release()}
          controller.close()
        } else controller.enqueue(part.value)
      }
      catch (error) {abort.abort(); release(); controller.error(error)}
    },
    async cancel() {
      cancelled = true; abort.abort(); release()
      // Abort inference, then drain the SDK's terminal/error frames for cleanup.
      // Cancelling its nested SSE transforms directly can leave rejected promises.
      try {while (!(await reader.read()).done) { /* Disconnected client: discard terminal frames. */ }}
      catch { /* The aborted upstream stream is expected to reject. No result is cached. */ }
    },
  }), {status: response.status, headers: response.headers})
}
