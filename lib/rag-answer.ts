import {demoEnabled,demoSettings} from './demo-config'
import { convertToModelMessages, streamText } from 'ai'
import { CHAT_MODEL, type RetrievedChunk } from './rag'
import { answerInstructions, type PromptVersion } from './rag-prompt'
import type { RagUIMessage } from './types'
import {workspaceEnabled} from './workspace-config'
import {evidenceProtocol} from './workspace-evidence'

// Clarify partial support without changing the frozen prompt or retrieval contract.
export const partialEvidenceInstructions = `For a question with multiple parts, check each part against the supplied excerpts separately. Answer only the supported parts. If a requested fact is missing, say that the supplied excerpts do not establish that fact; do not first supply a plausible answer from memory and then disclaim it. Cite factual statements only to the assigned excerpts that support them. Do not attach citations to statements about missing evidence: an excerpt about a related topic does not prove an absent fact. A document title or source reference does not supply text omitted from the excerpts.`

export function ragAnswerInstructions(retrieved: RetrievedChunk[], version?: PromptVersion) {
  return `${answerInstructions(retrieved, version)}\n\n${partialEvidenceInstructions}`+
    (workspaceEnabled()?`\n\n${evidenceProtocol}`:'')
}

/** Shared generation call for streaming chat and evaluation. */
export async function startRagAnswer(messages: RagUIMessage[], retrieved: RetrievedChunk[], version?: PromptVersion, signal?: AbortSignal) {
  const cloud=demoEnabled()?demoSettings():null
  if(cloud && Buffer.byteLength(JSON.stringify({messages,retrieved}))>12000) throw new Error("Public demo context limit exceeded")
  return streamText({
    ...(cloud?{maxRetries:0,maxOutputTokens:cloud.maxOutputTokens,timeout:cloud.timeoutMs}:{}),
    model: CHAT_MODEL,
    instructions: ragAnswerInstructions(retrieved, version),
    ...(signal ? {abortSignal: signal} : {}),
    messages: await convertToModelMessages(messages),
  })
}
