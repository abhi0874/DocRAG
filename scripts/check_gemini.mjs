import { readFileSync } from 'node:fs'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

const config = JSON.parse(readFileSync(new URL('../lib/model-config.json', import.meta.url), 'utf8'))
try {
  const result = await generateText({
    model: google(config.chat),
    prompt: 'Reply with OK.',
    maxOutputTokens: 256,
    providerOptions: { google: { thinkingConfig: { thinkingLevel: 'minimal' } } },
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(30000),
  })
  if (!result.text.trim()) throw new Error(`Empty response (finish reason: ${result.finishReason})`)
  console.log('Gemini: PASS (configured chat model, real request)')
} catch (error) {
  const failure = error?.lastError ?? error
  const status = Number.isInteger(failure?.statusCode) ? failure.statusCode : 'unavailable'
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const rawMessage = failure instanceof Error ? failure.message : 'Unknown error'
  const message = key ? rawMessage.split(key).join('[REDACTED]') : rawMessage
  console.error(`Gemini: FAIL (HTTP status: ${status}): ${message}`)
  process.exitCode = 1
}
