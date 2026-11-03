import {expect, it} from 'vitest'
import {citationReferences, validateCitations} from '@/lib/citations'

it.each(['[-1]', '[0]', '[2]', '[999]', '[+1]', '[1.0]', '[1abc]', '[1-2]', '[1,2]', '[01]', '[1', '[]'])(
  'rejects a reference to %s even when another reference exists', token => {
    expect(validateCitations(`First [1]. According to source ${token}`, 1)).toMatchObject({
      valid: false, kind: 'invalid-references', invalidTokens: [token],
    })
  })
it('does not let a valid citation hide a later empty attribution', () => {
  expect(validateCitations('First [1]. The second claim [].', 1).invalidTokens).toEqual(['[]'])
  expect(validateCitations('The default list is represented by the empty array [] [1].', 1).valid).toBe(true)
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

// Complete code never supplies a citation. Assert offsets as well as validity:
// the browser uses these same offsets for its source buttons.
it.each([
  'Use `items[-1]`.',
  'Use ``a `[-1]` example``.',
  '```x = items[-1]```',
  '   ```python\nx = items[-1]\n  ```` \t',
  '````sql\nSELECT \'[-1]\';\n```\n````',
  '~~~sql\nSELECT \'[-1]\';\n~~~~ \t',
  '- Example:\n  ```python\n  x = items[-1]\n  ```',
  '    SELECT \'[-1]\';',
])('continues validating prose after complete technical code: %s', code => {
  for (const nl of ['\n', '\r\n', '\r']) {
    const answer = ['First fact [1].', '', code, 'Second fact [2].'].join('\n').replaceAll('\n', nl)
    expect(validateCitations(answer, 2)).toMatchObject({valid: true, numbers: [1, 2]})
    const refs = citationReferences(answer, 2)
    expect(refs.map(ref => answer.slice(ref.start, ref.end))).toEqual(['[1]', '[2]'])
    for (const invalid of ['[-1]', '[999]']) {
      expect(validateCitations(answer + ' According to source ' + invalid, 2)).toMatchObject({
        valid: false, invalidTokens: [invalid],
      })
    }
  }
})

it.each([
  'Unclosed `inline', 'Mismatched ``inline```', '```sql\nSELECT 1',
  '~~~sql\nSELECT 1\n```', '````sql\nSELECT 1\n```',
  '```sql\nSELECT 1\n``` more', '```sql\nSELECT 1\n    ```',
  '`unclosed\n\nnew paragraph`',
])('withholds cache eligibility for incomplete delimiters: %s', markdown => {
  expect(validateCitations('Fact [1].\n' + markdown, 1)).toMatchObject({valid: false, kind: 'ambiguous-code'})
})

it('keeps escaped delimiters literal and checks explicit source attributions styled as code', () => {
  expect(validateCitations('A literal \\` and a valid source [1].', 1).valid).toBe(true)
  expect(validateCitations('Fact [1]. \\`According to source [-1].', 1).invalidTokens).toEqual(['[-1]'])
  expect(validateCitations('Fact [1]. According to source `[-1]`.', 1).invalidTokens).toEqual(['[-1]'])
})
