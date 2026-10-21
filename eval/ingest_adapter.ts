// Evaluation-only bridge. The application's algorithms remain in lib/rag.ts.
import { readFileSync } from 'node:fs'
import { chunkPages, embedChunks } from '../lib/rag'
import { pool } from '../lib/db'

async function main() {
  const input = JSON.parse(readFileSync(0, 'utf8')) as {
    action: 'chunk' | 'embed'; pages?: string[]; contents?: string[]
  }
  if (input.action === 'chunk' && Array.isArray(input.pages)) {
    process.stdout.write(JSON.stringify(chunkPages(input.pages)))
  } else if (input.action === 'embed' && Array.isArray(input.contents)) {
    process.stdout.write(JSON.stringify(await embedChunks(input.contents)))
  } else {
    throw new Error('Invalid ingestion action')
  }
}

main().catch((error: unknown) => {
  if (typeof error === 'object' && error !== null && 'lastError' in error) {
    error = error.lastError
  }
  // Provider error objects can contain private request details. Do not dump them.
  const status = typeof error === 'object' && error !== null && 'statusCode' in error
    ? String(error.statusCode) : 'unavailable'
  let detail = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error'
  for (const name of ['DATABASE_URL', 'DATABASE_URL_PROD', 'GOOGLE_GENERATIVE_AI_API_KEY']) {
    const secret = process.env[name]
    if (secret) detail = detail.split(secret).join('[REDACTED]')
  }
  detail = detail.replace(/https?:\/\/\S+/g, '[provider URL]').replace(/[\r\n]+/g, ' ')
  process.stderr.write(`Ingestion adapter failed; HTTP status: ${status}. ${detail}\n`)
  process.exitCode = 1
}).finally(() => pool.end())
