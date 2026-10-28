import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from 'ai'
import { selectContext } from '@/lib/select-context'
import { startRagAnswer } from '@/lib/rag-answer'
import type { RagUIMessage } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: Request) {
  const {
    messages,
    documentId,
  }: { messages: RagUIMessage[]; documentId?: number } = await req.json()

  if (!documentId) {
    return Response.json({ error: 'No document selected' }, { status: 400 })
  }

  // Extract the latest user question for retrieval
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const question =
    lastUser?.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join(' ') ?? ''

  // Hybrid retrieval: vector + keyword, fused with RRF
  const selection = await selectContext(question, documentId, 6)
  const retrieved = selection.ranked

  const stream = createUIMessageStream<RagUIMessage>({
    execute: async ({ writer }) => {
      // Send the retrieved sources to the client before the answer streams
      writer.write({
        type: 'data-sources',
        data: { sources: retrieved },
      })

      const result = await startRagAnswer(messages, retrieved)

      writer.merge(toUIMessageStream({ stream: result.stream }))
    },
  })

  return createUIMessageStreamResponse({ stream, headers: {
    'X-DocRAG-Reranker-Status': selection.trace.status,
    ...(selection.trace.reason ? {'X-DocRAG-Reranker-Reason': selection.trace.reason} : {}),
  } })
}
