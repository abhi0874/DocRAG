import { readFileSync } from 'node:fs'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

const config = JSON.parse(readFileSync(new URL('../lib/model-config.json', import.meta.url), 'utf8'))
try {
  const result = await generateText({
    model: google(config.chat),
    prompt: 'Reply with OK.',
    maxOutputTokens: 16,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(30000),
  })
  if (!result.text.trim()) throw new Error('Empty response')
  console.log('Gemini: PASS (configured chat model, real request)')
} catch {
  console.error('Gemini: FAIL. Check the private key, model access, quota, and network.')
  process.exitCode = 1
}
