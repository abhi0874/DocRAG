import {admitDemoQuestion} from '@/lib/demo-access'
import {currentTrace,measure} from '@/lib/observability/context'
import {answerMetadata,cachedAnswer,observeAnswer} from '@/lib/observability/answer'
import {observed} from '@/lib/observability/http'
import {checkOrigin,principal,jsonBody,chatInput,safeError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
import {acquireWork} from '@/lib/security/work'
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

async function handlePOST(req: Request) {
  const trace=currentTrace()
  let releaseWork:(()=>void)|undefined
  try {
  req.signal.throwIfAborted()
  checkOrigin(req)
  const userId=await principal(req,false)
  await consumeLimit(userId ? 'chat':'public',userId)
  const {messages,documentId}=await jsonBody(req,chatInput)
  if (!documentId) return Response.json({error: 'No document selected'}, {status: 400})
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const question = lastUser?.parts.filter(p => p.type === 'text').map(p => p.text).join(' ') ?? ''
  const snapshot = await measure('authorization',()=>documentSnapshot(documentId,userId))
  if (!snapshot) {responseCache.invalidateDocument(documentId); return Response.json({error: 'Document unavailable'}, {status: 404})}
  await admitDemoQuestion(snapshot,messages,userId)
  req.signal.throwIfAborted()
  releaseWork=acquireWork()
  const selection = await measure('retrieval',()=>selectContext(question, documentId, 6, undefined, undefined, timing=>{if(trace)Object.assign(trace.timings,timing)}, userId))
  req.signal.throwIfAborted()
  if(trace){trace.timings.selection_ms=selection.selection_ms;trace.timings.rerank_ms=selection.trace.elapsed_ms}
  const contextStart=performance.now()
  const retrieved = withEvidenceMetadata(selection.ranked, snapshot)
  const version = promptVersion()
  const metadata=answerMetadata(trace,snapshot,messages,retrieved,version)
  if(trace)trace.timings.context=performance.now()-contextStart
  const scope = publicCacheScope(snapshot, messages)
  const key = scope ? responseKey({question, scope, documentId, documentHash: snapshot.hash,
    context: retrieved, retrieval: retrievalDefault, reranker: {config: rerankerConfig(), status: selection.trace.status},
    model: await cacheModelIdentity(), prompt: {version, instructions: answerInstructions(retrieved, version)},
    history: messages.map(m => ({role: m.role, parts: m.parts}))}) : null
  // A concurrent edit must not turn a previously eligible snapshot into a stale hit.
  const current = key ? await documentSnapshot(documentId,userId) : snapshot
  if (!current || current.hash !== snapshot.hash) {releaseWork();return Response.json({error: 'Document changed; retry'}, {status: 409})}
  const cacheStart=performance.now()
  const hit = key && scope ? responseCache.get(key, scope, answer => validateCitations(answer.text, retrieved.length).valid) : undefined
  const owner = !!(key && !hit && responseCache.acquire(key))
  const status = hit ? 'HIT' : !key ? 'BYPASS' : owner ? 'MISS' : 'BYPASS_BUSY'
  if(trace){trace.cache=status;trace.timings.cache_lookup=performance.now()-cacheStart}
  const abort = new AbortController()
  const signal = AbortSignal.any([req.signal, abort.signal])
  let completedAnswer: CachedAnswer | undefined
  let released = false
  const release = () => {
    if (released) return
    released = true
    releaseWork?.()
    if (owner && key) responseCache.release(key)
  }
  const stream = createUIMessageStream<RagUIMessage>({
    onError: () => {if(trace){trace.failed=true;trace.errorCategory='model'}release(); return 'The answer could not be completed. Please retry.'},
    execute: async ({writer}) => {
      // Establish the assistant message ID before the client receives its data.
      writer.write({type: 'start',...(trace?{messageId:trace.id}:{})})
      writer.write({type: 'data-sources', data: {sources: retrieved}})
      writer.write({type: 'data-cache', data: {status, tokensAvoided: hit?.tokens ?? null}})
      if (hit) {
        cachedAnswer(trace,metadata,hit.text,hit.tokens)
        writer.write({type: 'text-start', id: 'cached-answer'})
        writer.write({type: 'text-delta', id: 'cached-answer', delta: hit.text})
        writer.write({type: 'text-end', id: 'cached-answer'})
        writer.write({type: 'data-validation', data: validateCitations(hit.text, retrieved.length)})
        writer.write({type: 'finish', finishReason: 'stop'})
        return
      }
      try {
        const result = await measure('model_start',()=>startRagAnswer(messages, retrieved, version, signal))
        // A disconnect can arrive during async model setup. Do not construct a
        // new abortable pipeline after its signal has already been aborted.
        if(signal.aborted){await result.stream.cancel(signal.reason);release();return}
        const observed = validatedStream(observeAnswer(result.stream,trace,metadata), retrieved.length, signal, async answer => {
          completedAnswer = answer
        }, result => writer.write({type: 'data-validation', data: result}), () => {if (!completedAnswer) release()})
        writer.merge(toUIMessageStream({stream: observed, sendStart: false}))
      } catch (error) {release(); throw error}
    },
  })
  const response = createUIMessageStreamResponse({stream, headers: {
    'Cache-Control':'no-store', 'X-DocRAG-Cache': status, 'X-DocRAG-Prompt': version,
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
            if (owner && !released && key && scope && completedAnswer && !signal.aborted) {
              const after = await documentSnapshot(documentId,userId)
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
      catch(error) {
        // Only this request's intentional abort belongs to normal teardown.
        if(!(signal.aborted&&(error===signal.reason||error instanceof Error&&error.name==='AbortError')))throw error
      } finally {reader.releaseLock()}
    },
  }), {status: response.status, headers: response.headers})
  } catch(error){releaseWork?.();return safeError(error)}
}

export const POST=observed('/api/chat',handlePOST)
