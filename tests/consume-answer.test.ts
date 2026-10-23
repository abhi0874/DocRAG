import { expect, it } from 'vitest'
import { consumeAnswer } from '../eval/consume-answer'

it('surfaces the provider error when result promises report only missing output', async () => {
  const providerError = new Error('Provider quota exceeded')
  const missingOutput = new Error('No output generated. Check the stream for errors.')
  await expect(consumeAnswer({
    text: Promise.reject(missingOutput),
    totalUsage: Promise.reject(missingOutput),
    finishReason: Promise.reject(missingOutput),
    stream: (async function* () { yield { type: 'error', error: providerError } })(),
  })).rejects.toBe(providerError)
})

it('rejects partial text when an error was present in the answer stream', async () => {
  const providerError = new Error('Connection failed before completion')
  await expect(consumeAnswer({
    text: Promise.resolve('Partial answer'),
    totalUsage: Promise.resolve({ totalTokens: 10 }),
    finishReason: Promise.resolve('error'),
    stream: (async function* () {
      yield { type: 'text-delta' }
      yield { type: 'error', error: providerError }
    })(),
  })).rejects.toBe(providerError)
})

it('preserves a successful answer, provider usage and finish reason', async () => {
  const usage = { totalTokens: 42 }
  const result = await consumeAnswer({
    text: Promise.resolve('The documented answer. [1]'),
    totalUsage: Promise.resolve(usage),
    finishReason: Promise.resolve('stop'),
    stream: (async function* () { yield { type: 'finish' } })(),
  })
  expect(result).toEqual({ text: 'The documented answer. [1]', usage, finishReason: 'stop' })
  expect(result.usage).toBe(usage)
})
