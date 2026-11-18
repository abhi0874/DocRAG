import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { validateCitations } from '@/lib/citations'
import type { RetrievedChunk } from '@/lib/rag'
import { insufficientEvidence, validateAssessment } from '@/lib/workspace-evidence'

type Trial = {
  id: string
  trial: string
  ids: number[]
  reply: string
  componentAnswers: string[]
}
type Question = { id: string; ranked_chunks: RetrievedChunk[] }
const report = JSON.parse(readFileSync('docs/gemini-repair/MULTIPASSAGE_RESULTS.json', 'utf8')) as {
  trials: Trial[]
  synthetic_sources: Record<string, { sources: string[] }>
}
const benchmark = JSON.parse(readFileSync('eval/results/observability/grounding-repair-a/evaluation.json', 'utf8')) as {
  questions: Question[]
}

function trial(id: string) {
  const result = report.trials.find(r => r.id === id && r.trial === 'independent')
  if (!result) throw new Error(`Missing independent-answer trace for ${id}`)
  return result
}

function checkQuote(sources: RetrievedChunk[], citation: number, quote: string) {
  const header = JSON.stringify({support: 'partial', evidence: [{citation, quote}]})
  return validateAssessment(header, sources)
}

it.each([
  {id: 'fastapi-036', firstId: 92, firstQuote: 'Assign that result to the parameter in your path operation function.',
    secondId: 72, secondQuote: 'it will terminate that request right away', originalSecondRank: 10},
  {id: 'postgresql-040', firstId: 161, firstQuote: 'relabeled the weather table as w1 and w2',
    secondId: 153, secondQuote: 'An aggregate function computes a single result from multiple input rows.', originalSecondRank: 6},
])('maps each step of $id to the exact passage used to answer it', example => {
  const {ids, componentAnswers} = trial(example.id)
  const ranked = benchmark.questions.find(q => q.id === example.id)!.ranked_chunks
  expect(ranked[example.originalSecondRank - 1].id).toBe(example.secondId)
  const sources = ids.map(id => ranked.find(c => c.id === id)!)
  expect(sources).toHaveLength(6)
  expect(componentAnswers).toHaveLength(2)
  const facts = [[example.firstId, example.firstQuote], [example.secondId, example.secondQuote]] as const
  for (const [step, [id, quote]] of facts.entries()) {
    const citation = ids.indexOf(id) + 1
    const references = validateCitations(componentAnswers[step], sources.length)
    expect(references.valid).toBe(true)
    expect(references.numbers).toContain(citation)
    expect(checkQuote(sources, citation, quote).evidence).toEqual([{citation, quote}])
    const wrongCitation = ids.indexOf(step === 0 ? example.secondId : example.firstId) + 1
    expect(() => checkQuote(sources, wrongCitation, quote)).toThrow()
  }
})

it.each([
  {id: 'comparison', quotes: ['twelve seats', 'eight seats'], citations: [1, 1, 2],
    conclusion: 'four more than the Cedar room, which has eight seats [2]'},
  {id: 'conflict', quotes: ['ten on Monday', 'noon on Monday'], citations: [1, 2, 1, 2],
    conclusion: 'the two notices do not agree'},
  {id: 'no-link', quotes: ['opened on Tuesday', 'new shelving at the Harbor library'], citations: [1, 2],
    conclusion: 'do not establish that the Cedar grant paid for Juniper'},
])('preserves separate document evidence for $id', ({id, quotes, citations, conclusion}) => {
  const sources = report.synthetic_sources[id].sources.map((content, i) => ({
    id: i + 1, documentId: i + 1, pageNumber: 1, chunkIndex: 0, content,
    vectorScore: null, keywordScore: null, rrfScore: 0,
  }))
  for (const [i, quote] of quotes.entries()) {
    expect(checkQuote(sources, i + 1, quote).evidence[0].quote).toBe(quote)
    expect(() => checkQuote(sources, 2 - i, quote)).toThrow()
  }
  expect(trial(id).componentAnswers[1]).toContain(conclusion)
  expect(validateCitations(trial(id).reply, sources.length).numbers).toEqual(citations)
  if (id === 'no-link') {
    expect(() => checkQuote(sources, 2, 'The Cedar grant paid for Juniper')).toThrow()
  }
})

it.each(['missing', 'postgresql-044'])('rejects concatenating two correct refusals for %s', id => {
  const saved = trial(id)
  expect(saved.componentAnswers).toEqual([insufficientEvidence, insufficientEvidence])
  expect(validateCitations(insufficientEvidence, saved.ids.length).kind).toBe('uncited-refusal')
  expect(validateCitations(saved.reply, saved.ids.length)).toMatchObject({valid: false, kind: 'missing-references'})
})
