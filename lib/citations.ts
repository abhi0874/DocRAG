/** Structural checks only. A valid number is NOT proof of semantic support. */
export function validateCitations(text: string, sourceCount: number) {
  const numbers = [...text.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]))
  const invalid = numbers.filter(n => !Number.isSafeInteger(n) || n < 1 || n > sourceCount)
  const duplicates = /\[(\d+)\](?:\s*\[\1\])+/.test(text)
  return {valid: text.trim().length > 0 && invalid.length === 0 && !duplicates,
    numbers, invalid, adjacentDuplicates: duplicates, semanticSupport: 'not-verified' as const}
}
