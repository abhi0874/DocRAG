import { convertToModelMessages, streamText } from 'ai'
import { CHAT_MODEL, type RetrievedChunk } from './rag'
import { answerInstructions, type PromptVersion } from './rag-prompt'
import type { RagUIMessage } from './types'

/** Shared generation call for streaming chat and evaluation. */
export async function startRagAnswer(messages: RagUIMessage[], retrieved: RetrievedChunk[], version?: PromptVersion, signal?: AbortSignal) {
  return streamText({
    model: CHAT_MODEL,
    instructions: answerInstructions(retrieved, version),
    ...(signal ? {abortSignal: signal} : {}),
    messages: await convertToModelMessages(messages),
  })
}
