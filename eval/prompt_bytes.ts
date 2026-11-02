import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { documentSnapshot, withEvidenceMetadata } from '../lib/evidence'
import { pool } from '../lib/db'
import { answerInstructions, type PromptVersion } from '../lib/rag-prompt'
import type { RetrievedChunk } from '../lib/rag'
import manifest from '../lib/public-cache-manifest.json'

interface SavedQuestion {
  id: string
  document_key: string
  ranked_chunks: RetrievedChunk[]
  answer_context_count: number
}

async function main() {
  const frozen = await import(pathToFileURL(process.argv[2]).href)
  const previous: typeof answerInstructions = frozen.answerInstructions ?? frozen.default.answerInstructions
  const snapshots = new Map()
  for (const entry of manifest.documents) {
    const snapshot = await documentSnapshot(entry.id)
    if (!snapshot || snapshot.hash !== entry.hash) throw new Error('Public snapshot differs')
    snapshots.set(entry.id, snapshot)
  }
  const hashes: Record<string, Record<string, string>> = {}
  for (const version of ['step5-v1', 'grounded-v1'] as PromptVersion[]) {
    const file = JSON.parse(readFileSync(`eval/results/prompting/${version}.json`, 'utf8'))
    hashes[version] = {}
    for (const row of file.questions as SavedQuestion[]) {
      const snapshot = snapshots.get(row.document_key === 'fastapi' ? 3 : 4)
      const context = withEvidenceMetadata(row.ranked_chunks.slice(0, row.answer_context_count), snapshot)
      const measured = previous(context, version)
      const current = answerInstructions(context, version)
      if (current !== measured) throw new Error(`Prompt changed for ${row.id} (${version})`)
      hashes[version][row.id] = createHash('sha256').update(current).digest('hex')
    }
  }
  return hashes
}
main().then(result => process.stdout.write(JSON.stringify(result)))
  .finally(() => pool.end()).catch(() => {process.stderr.write('Prompt replay failed\n'); process.exitCode = 1})
