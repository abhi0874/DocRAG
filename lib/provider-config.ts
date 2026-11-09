import {demoEnabled,demoDatabaseUrl} from './demo-config'
import local from './local-model-config.json'

export function providerName(): 'gemini' | 'ollama' {
  const name = process.env.AI_PROVIDER || 'gemini'
  if (name !== 'gemini' && name !== 'ollama') throw new Error('AI_PROVIDER must be gemini or ollama')
  return name
}

export function ollamaBaseUrl() {
  const url = new URL(process.env.OLLAMA_BASE_URL || local.baseUrl)
  if (url.protocol !== 'http:' || !(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (process.env.DOCRAG_RUNTIME === 'container' && url.hostname === 'host.docker.internal' && url.port === '11434'))
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
  if(demoEnabled()) return demoDatabaseUrl()
  if (providerName() === 'gemini') return process.env.DATABASE_URL
  // Local mode can never use the Gemini application or evaluation database.
  const value = process.env.OLLAMA_DATABASE_URL
  if (!value) throw new Error('Local mode requires its isolated OLLAMA_DATABASE_URL')
  const url = new URL(value)
  const experiment = process.env.DOCRAG_CHUNKING_EXPERIMENT
  if (process.env.DOCRAG_RUNTIME === 'container') {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'db' || url.port !== '5432' || url.pathname !== '/docrag_container' || url.search || url.hash) throw new Error('Container mode requires its dedicated database')
    return value
  }
  const securityTest = /^\/docrag_security_test_[a-f0-9]{12}$/.test(url.pathname)
  const allowedPath = securityTest ? url.pathname : experiment && /^(control|heading)-(1000-200|700-140|1400-280|1000-100)$/.test(experiment)
    ? `/docrag_chunking_${experiment.replaceAll('-', '_')}` : '/docrag_ollama_v1'
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== postgresPort()
    || url.pathname !== allowedPath || url.search || url.hash) {
    throw new Error('Local mode requires the isolated native Ollama database')
  }
  return value
}

export function postgresPort() {
  const value=process.env.DOCRAG_POSTGRES_PORT ?? '55432'
  if (!/^[0-9]{4,5}$/.test(value) || Number(value)<1024 || Number(value)>65535) throw new Error('Invalid DocRAG PostgreSQL port')
  return value
}
