import local from './local-model-config.json'

export function providerName(): 'gemini' | 'ollama' {
  const name = process.env.AI_PROVIDER || 'gemini'
  if (name !== 'gemini' && name !== 'ollama') throw new Error('AI_PROVIDER must be gemini or ollama')
  return name
}

export function ollamaBaseUrl() {
  const url = new URL(process.env.OLLAMA_BASE_URL || local.baseUrl)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Ollama requires an unauthenticated loopback HTTP endpoint')
  }
  return url.origin
}

export function localSettings() {
  return { ...local, baseUrl: ollamaBaseUrl(),
    chat: process.env.OLLAMA_MODEL || local.chat,
    embedding: process.env.OLLAMA_EMBEDDING_MODEL || local.embedding }
}

export function databaseConnection() {
  if (providerName() === 'gemini') return process.env.DATABASE_URL
  // Local mode can never use the Gemini application or evaluation database.
  const value = process.env.OLLAMA_DATABASE_URL
  if (!value) throw new Error('Local mode requires its isolated OLLAMA_DATABASE_URL')
  const url = new URL(value)
  const experiment = process.env.DOCRAG_CHUNKING_EXPERIMENT
  const allowedPath = experiment && /^(control|heading)-(1000-200|700-140|1400-280|1000-100)$/.test(experiment)
    ? `/docrag_chunking_${experiment.replaceAll('-', '_')}` : '/docrag_ollama_v1'
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== '55432'
    || url.pathname !== allowedPath || url.search || url.hash) {
    throw new Error('Local mode requires the isolated native Ollama database')
  }
  return value
}
