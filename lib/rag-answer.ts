import { convertToModelMessages, streamText } from 'ai'
import { buildContext, CHAT_MODEL, RAG_INSTRUCTIONS, type RetrievedChunk } from './rag'
import type { RagUIMessage } from './types'

/** Shared unchanged chat generation call, also exercised by the evaluation adapter. */
export async function startRagAnswer(messages: RagUIMessage[], retrieved: RetrievedChunk[]) {
  return streamText({
    model: CHAT_MODEL,
    instructions: `${RAG_INSTRUCTIONS}\n\nContext excerpts:\n\n${buildContext(retrieved)}`,
    messages: await convertToModelMessages(messages),
  })
}
