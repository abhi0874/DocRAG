import { generateText } from 'ai'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { evaluations } from '@/lib/db/schema'
import {
  CHAT_MODEL,
} from '@/lib/rag'
import { answerInstructions } from '@/lib/rag-prompt'
import { documentSnapshot, withEvidenceMetadata } from '@/lib/evidence'
import { validateCitations } from '@/lib/citations'
import { selectContext } from '@/lib/select-context'

export const maxDuration = 120

export async function GET() {
  const rows = await db
    .select()
    .from(evaluations)
    .orderBy(desc(evaluations.createdAt))
    .limit(20)
  return Response.json(rows)
}

export async function POST(req: Request) {
  const { documentId, question }: { documentId?: number; question?: string } =
    await req.json()

  if (!documentId || !question?.trim()) {
    return Response.json(
      { error: 'documentId and question are required' },
      { status: 400 },
    )
  }

  // Retrieve context for the RAG answer
  const selection = await selectContext(question, documentId, 6)
  const snapshot = await documentSnapshot(documentId)
  if (!snapshot) return Response.json({error: 'Document unavailable'}, {status: 404})
  const retrieved = withEvidenceMetadata(selection.ranked, snapshot)

  // Run both answers in parallel: with retrieval vs. without
  const [ragResult, noRagResult] = await Promise.all([
    generateText({
      model: CHAT_MODEL,
      instructions: answerInstructions(retrieved),
      prompt: question,
    }),
    generateText({
      model: CHAT_MODEL,
      instructions:
        'Answer the question from your general knowledge only. Be concise. If you are unsure or the question refers to a specific document you cannot see, say so honestly.',
      prompt: question,
    }),
  ])

  const [saved] = await db
    .insert(evaluations)
    .values({
      documentId,
      question,
      ragAnswer: ragResult.text,
      noRagAnswer: noRagResult.text,
      retrievedChunks: retrieved,
    })
    .returning()

  return Response.json({...saved, reranking: selection.trace, citationValidation: validateCitations(ragResult.text, retrieved.length)})
}
