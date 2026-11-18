import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { evidenceIndex, selectWindow } from '../eval/diagnostics/targeted-evidence'
import type { RetrievedChunk } from '../lib/rag'
import { validateCitations } from '../lib/citations'
import { insufficientEvidence } from '../lib/workspace-evidence'

type Reply = { id: string; method: string; answer: string; passed: boolean; changed: boolean }
type Fixture = { id: string; question: string; texts: string[]; distinct_documents?: boolean }
const receipt = JSON.parse(readFileSync('docs/gemini-repair/TARGETED_RESULTS.json', 'utf8')) as {
  selection_held_out: {name: string; ranked: RetrievedChunk[]; needed: string}[]
  selection_changed: {id: string; selected: number[]}[]
  lookup_active: Record<string, string>
  synthesis_fixtures: Fixture[]
  completed_diagnostics: Reply[]
  workspace_stream_trials: {workspace_route_grounded_v1: Reply[]}
}
const benchmark = JSON.parse(readFileSync('eval/results/observability/grounding-repair-a/evaluation.json', 'utf8')) as {
  questions: {id: string; question: string; ranked_chunks: RetrievedChunk[]}[]
}

it('replays every compared selection and verbatim lookup against the original ranking', () => {
  expect(benchmark.questions).toHaveLength(100)
  for (const row of benchmark.questions) {
    // Each frozen question is scoped to one authorized public document.
    const ranked = row.ranked_chunks.map(chunk => ({...chunk, documentId: 1}))
    const original = ranked.slice(0, 6)
    const saved = receipt.selection_changed.find(change => change.id === row.id)
    expect(selectWindow(ranked).map(c => c.id)).toEqual(saved?.selected ?? original.map(c => c.id))
    expect(evidenceIndex(row.question, original)).toBe(receipt.lookup_active[row.id] ?? '')
  }
})

it.each(receipt.selection_held_out)('reproduces the lost unique evidence in $name', ({ranked, needed}) => {
  expect(ranked.slice(0, 6).some(c => c.content.includes(needed))).toBe(true)
  expect(selectWindow(ranked).some(c => c.content.includes(needed))).toBe(false)
})

it('matches activation on every measured independent fixture', () => {
  for (const f of receipt.synthesis_fixtures) {
    const passages = f.texts.map((content, i) => ({
      id: i + 1, content, pageNumber: i + 1, chunkIndex: i, documentId: f.distinct_documents ? i + 1 : 1,
      rrfScore: 0, vectorScore: null, keywordScore: null,
    }))
    const reply = receipt.completed_diagnostics.find(r => r.id === f.id && r.method === 'synthesis')!
    expect(Boolean(evidenceIndex(f.question, passages))).toBe(reply.changed)
  }
})

it('distinguishes two unattached citations from their in-range numbers', () => {
  const pair = receipt.completed_diagnostics.filter(r => r.id === 'fastapi-039')
  const candidate = pair.find(r => r.method === 'synthesis')!.answer
  expect(validateCitations(candidate, 6).valid).toBe(true)
  expect(candidate.split('\n\n').at(-1)).toBe('[1]\n[5]')
  expect(pair.find(r => r.method === 'control')!.answer).not.toMatch(/\n\n\[1\]\n\[5\]$/)
})

it('replays the workspace attribution error on conflicting notices', () => {
  const f = receipt.synthesis_fixtures.find(f => f.id === 'matched-disagreement')!
  expect(f.texts[2]).toBe('The violet line dates are June 3 and June 7.')
  const pair = receipt.workspace_stream_trials.workspace_route_grounded_v1.filter(r => r.id === f.id)
  expect(pair.every(r => r.passed)).toBe(true)
  expect(pair.find(r => r.method === 'synthesis')!.answer).toMatch(/do not establish which copper line hours apply\. \[1\]\[2\]\[3\]$/)
  expect(pair.find(r => r.method === 'control')!.answer).not.toMatch(/copper line hours apply\. \[1\]\[2\]\[3\]$/)
})

it('keeps one canonical workspace refusal when both requested facts are absent', () => {
  const pair = receipt.workspace_stream_trials.workspace_route_grounded_v1.filter(r => r.id === 'paired-absent')
  expect(pair).toHaveLength(2)
  for (const r of pair) expect(r.answer).toBe(insufficientEvidence)
})
