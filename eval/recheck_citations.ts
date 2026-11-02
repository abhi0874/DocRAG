import {readFileSync} from 'node:fs'
import {validateCitations} from '../lib/citations'

interface Answer {id: string; answer: string; answer_context_count: number}
const expectedIds = new Set(readFileSync('eval/golden_set.jsonl', 'utf8').trim().split('\n')
  .map(line => JSON.parse(line).id as string))
for (const version of ['step5-v1', 'grounded-v1']) {
  const rows: Answer[] = JSON.parse(readFileSync(`eval/results/prompting/${version}.json`, 'utf8')).questions
  if (expectedIds.size !== 100 || rows.length !== 100 || new Set(rows.map(row => row.id)).size !== 100)
    throw new Error('Incomplete saved question set')
  const counts: Record<string, number> = {}
  const rejected: string[] = []
  for (const row of rows) {
    if (!expectedIds.has(row.id) || !Number.isInteger(row.answer_context_count) || row.answer_context_count < 1)
      throw new Error(`Invalid saved evidence: ${row.id}`)
    const result = validateCitations(row.answer, row.answer_context_count)
    counts[result.kind] = (counts[result.kind] ?? 0) + 1
    if (!result.valid) rejected.push(row.id)
  }
  console.log(JSON.stringify({version, checked: rows.length, counts, rejected}))
  if (version === 'step5-v1' && rejected.length) throw new Error('Selected answers failed citation replay')
}

for (const name of ['selected', 'candidate']) {
  const {rows} = JSON.parse(readFileSync(`eval/results/prompting/${name}-final-diagnostics.json`, 'utf8'))
  if (rows.length !== 6) throw new Error('Incomplete grounding diagnostics')
  for (const row of rows) {
    if (!validateCitations(row.response.text, row.context.length).valid)
      throw new Error(`Invalid reference in saved diagnostic ${name}/${row.id}`)
  }
  console.log(`${name}: six saved grounding diagnostics passed structural replay`)
}
