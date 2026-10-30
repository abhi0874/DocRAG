import { stableHash } from './response-cache'
import manifest from './public-cache-manifest.json'
import type { DocumentSnapshot } from './evidence'
import { localSettings, providerName } from './provider-config'
import { ollamaRequest, verifyLocalModels } from './ollama'
import type { RagUIMessage } from './types'

/** A browser cannot opt a private document into this fixed public corpus. */
export function publicCacheScope(snapshot: DocumentSnapshot, messages: RagUIMessage[]) {
  if (process.env.RESPONSE_CACHE_ENABLED !== 'true' || providerName() !== 'ollama' ||
      process.env.DOCRAG_CHUNKING_EXPERIMENT !== manifest.experiment ||
      messages.length !== 1 || messages[0].role !== 'user' ||
      messages[0].parts.length !== 1 || messages[0].parts[0].type !== 'text') return null
  const questionHash = stableHash(messages[0].parts[0].text.trim())
  if (!manifest.questions.some(q => q.documentId === snapshot.document.id && q.hash === questionHash)) return null
  const entry = manifest.documents.find(d => d.id === snapshot.document.id && d.hash === snapshot.hash)
  return entry ? manifest.scope : null
}
export async function cacheModelIdentity() {
  // Never cache a mutable provider alias or silently trust an env-supplied digest.
  await verifyLocalModels()
  const version = await (await ollamaRequest('/api/version')).json() as {version: string}
  return {...localSettings(), runtimeVersion: version.version}
}
