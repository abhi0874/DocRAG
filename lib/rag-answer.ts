import {demoEnabled,demoSettings} from './demo-config'
import { convertToModelMessages, streamText } from 'ai'
import { CHAT_MODEL, type RetrievedChunk } from './rag'
import { answerInstructions, type PromptVersion } from './rag-prompt'
import type { RagUIMessage } from './types'

/** Shared generation call for streaming chat and evaluation. */
export async function startRagAnswer(messages: RagUIMessage[], retrieved: RetrievedChunk[], version?: PromptVersion, signal?: AbortSignal) {
  const cloud=demoEnabled()?demoSettings():null
  if(cloud && Buffer.byteLength(JSON.stringify({messages,retrieved}))>12000) throw new Error("Public demo context limit exceeded")
  return streamText({
    ...(cloud?{maxRetries:0,maxOutputTokens:cloud.maxOutputTokens,timeout:cloud.timeoutMs}:{}),
    model: CHAT_MODEL,
    instructions: answerInstructions(retrieved, version),
    ...(signal ? {abortSignal: signal} : {}),
    messages: await convertToModelMessages(messages),
  })
}
