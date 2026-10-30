import type { UIMessage } from 'ai'

export interface SourceChunk {
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

export type RagUIMessage = UIMessage<
  never,
  {
    cache: {status: string; tokensAvoided: number | null}
    validation: {valid: boolean; semanticSupport: 'not-verified'; invalid: number[]; adjacentDuplicates: boolean}
    sources: {
      sources: SourceChunk[]
    }
  }
>

export interface DocumentInfo {
  id: number
  title: string
  filename: string
  pageCount: number
  chunkCount: number
  status: string
  createdAt: string
}

export interface EvaluationResult {
  id: number
  documentId: number
  question: string
  ragAnswer: string
  noRagAnswer: string
  retrievedChunks: SourceChunk[]
  createdAt: string
}
