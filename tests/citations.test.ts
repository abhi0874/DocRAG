import {expect, it} from 'vitest'
import {citationReferences, validateCitations} from '@/lib/citations'

it.each(['[-1]', '[0]', '[2]', '[999]', '[+1]', '[1.0]', '[1abc]', '[1-2]', '[1,2]', '[01]', '[1', '[]'])(
  'rejects a reference to %s even when another reference exists', token => {
    expect(validateCitations(`First [1]. According to source ${token}`, 1)).toMatchObject({
      valid: false, kind: 'invalid-references', invalidTokens: [token],
    })
  })
it('accepts separate valid sources and rejects adjacent duplicates', () => {
  expect(validateCitations('It begins here [1][2]. The ending is unknown.', 2).kind).toBe('cited')
  expect(validateCitations('Fact [1] [1].', 1)).toMatchObject({valid: false, adjacentDuplicates: true})
})
it.each(['I cannot determine that from the supplied documents.', 'I could not find this in the document.'])(
  'allows an uncited refusal: %s', answer => {
    expect(validateCitations(answer, 1)).toMatchObject({valid: true, kind: 'uncited-refusal'})
  })
it.each(['It returns 3.', '', 'I could not find this in the document. It returns 3.'])(
  'requires citations for other text: %s', answer => {
    expect(validateCitations(answer, 1)).toMatchObject({valid: false, kind: 'missing-references'})
  })
it('keeps literal text, numeric Markdown links and code separate from clickable sources', () => {
  const text = 'Labels [optional], an empty array [], the literal "[-1]", `x[99]` and [2](https://example.org/a(1)).\n```ts\nx[2]; y[-1]\n```\nThe result is supported [1].'
  expect(citationReferences(text, 2).map(ref => text.slice(ref.start, ref.end))).toEqual(['[1]'])
  expect(validateCitations(text, 2).valid).toBe(true)
  expect(validateCitations('According to source "[-1]", the result is 3 [1].', 1).valid).toBe(false)
})
