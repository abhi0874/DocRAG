import { google, type GoogleEmbeddingModelOptions } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'
import { retrieve } from './retrieval'
import { retrievalDefault, type RetrievalConfig, type RetrievalTiming } from './retrieval-config'
import modelConfig from './model-config.json'
import { localSettings, providerName } from './provider-config'
import { localEmbeddings, ollamaLanguageModel } from './ollama'

// Google Gemini latest models (free tier, no credit card needed).
// gemini-embedding-2 outputs 1536 dims to match the vector(1536) column.
export const EMBEDDING_MODEL = google.embedding(modelConfig.embedding)
export const CHAT_MODEL = providerName() === 'ollama' ? ollamaLanguageModel() : google(modelConfig.chat)
export const EMBEDDING_DIMENSIONS = providerName() === 'ollama'
  ? localSettings().embeddingDimensions : modelConfig.embeddingDimensions

export { chunkPages } from './chunking'
export type { TextChunk } from './chunking'

export interface RetrievedChunk {
  id: number
  documentId?: number
  title?: string
  sourceId?: string
  sectionTitle?: string
  sourceUrl?: string
  content: string
  pageNumber: number
  chunkIndex: number
  vectorScore: number | null
  keywordScore: number | null
  rrfScore: number
}

/** Batch-embed chunk contents. Order is preserved. */
export async function embedChunks(contents: string[]): Promise<number[][]> {
  if (providerName() === 'ollama') return (await localEmbeddings(contents, 'document')).embeddings
  const allEmbeddings: number[][] = []
  // Embed in batches to stay under provider limits
  const BATCH = 100
  for (let i = 0; i < contents.length; i += BATCH) {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: contents.slice(i, i + BATCH),
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: 'RETRIEVAL_DOCUMENT',
        } satisfies GoogleEmbeddingModelOptions,
      },
    })
    allEmbeddings.push(...embeddings)
  }
  return allEmbeddings
}

/**
 * Hybrid search: vector similarity (semantic) + full-text search (keyword),
 * fused with Reciprocal Rank Fusion (RRF). Returns top K chunks.
 */
export async function hybridSearch(
  query: string, documentId: number, topK = 6,
  config: RetrievalConfig = retrievalDefault,
  observer?: (timing: RetrievalTiming) => void,
  userId:string|null=null,
): Promise<RetrievedChunk[]> {
  return retrieve(query, documentId, topK, config, async () => {
  const { embedding } = providerName() === 'ollama'
    ? { embedding: (await localEmbeddings([query], 'query')).embeddings[0] }
    : await embed({
    model: EMBEDDING_MODEL,
    value: query,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'RETRIEVAL_QUERY',
      } satisfies GoogleEmbeddingModelOptions,
    },
  })
    return embedding
  }, observer, userId)
}

/** Build the numbered context block the model cites from. */
export function buildContext(retrieved: RetrievedChunk[]): string {
  return retrieved
    .map(
      (c, i) =>
        `[${i + 1}] (page ${c.pageNumber})\n${c.content}`,
    )
    .join('\n\n---\n\n')
}

export const RAG_INSTRUCTIONS = `You are a document assistant. Answer the user's question using ONLY the numbered context excerpts provided below. Rules:
- Cite every claim with the excerpt number in square brackets, e.g. [1] or [2][3].
- If the context does not contain the answer, say "I could not find this in the document." Do not invent information.
- Be concise and direct. Use the page numbers when helpful.`
