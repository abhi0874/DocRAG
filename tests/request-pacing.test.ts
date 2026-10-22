import { expect, it } from 'vitest'
import { generationPacer } from '../eval/request-pacing'

it('keeps retries and successive adapters within five generation requests per minute', async () => {
  let now = 100_000
  let last = 0
  const sent: number[] = []
  for (let attempt = 0; attempt < 8; attempt++) {
    // Recreate the adapter while sharing the persisted last-request timestamp.
    const pace = generationPacer({
      intervalMs: 13_000, readLast: () => last, writeLast: at => { last = at },
      now: () => now, sleep: async ms => { now += ms },
    })
    const operation = attempt % 2 ? 'streamGenerateContent' : 'generateContent'
    await pace(new URL(`https://generativelanguage.googleapis.com/v1beta/models/test:${operation}`))
    sent.push(now)
  }
  expect(sent[0]).toBe(100_000)
  for (const end of sent) {
    expect(sent.filter(at => at <= end && at > end - 60_000).length).toBeLessThanOrEqual(5)
  }
})

it('does not consume the generation interval for embeddings or unrelated hosts', async () => {
  const writes: number[] = []
  const waits: number[] = []
  const pace = generationPacer({
    intervalMs: 13_000, readLast: () => 100_000, now: () => 100_001,
    writeLast: at => { writes.push(at) }, sleep: async ms => { waits.push(ms) },
  })
  expect(await pace(new URL('https://generativelanguage.googleapis.com/v1beta/models/test:embedContent'))).toBe(false)
  expect(await pace(new URL('https://example.com/test:generateContent'))).toBe(false)
  expect(writes).toEqual([])
  expect(waits).toEqual([])
})
