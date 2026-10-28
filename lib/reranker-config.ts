import model from './reranker-model.json'

export interface RerankerConfig {
  enabled: boolean
  candidates: 10 | 20
  device: 'cpu' | 'mps'
  timeoutMs: number
  model: string
  revision: string
}

export function validateRerankerConfig(value: RerankerConfig): RerankerConfig {
  if (typeof value.enabled !== 'boolean' || ![10, 20].includes(value.candidates) ||
      !['cpu', 'mps'].includes(value.device) || !Number.isInteger(value.timeoutMs) ||
      value.timeoutMs < 100 || value.timeoutMs > 60000 ||
      value.model !== model.model || value.revision !== model.revision) {
    throw new Error('Invalid reranker configuration')
  }
  return value
}

export function rerankerConfig(): RerankerConfig {
  const enabled = process.env.RERANKER_ENABLED ?? 'false'
  if (!['true', 'false'].includes(enabled)) throw new Error('RERANKER_ENABLED must be true or false')
  return validateRerankerConfig({
    enabled: enabled === 'true', candidates: Number(process.env.RERANKER_CANDIDATES ?? 10) as 10 | 20,
    device: (process.env.RERANKER_DEVICE ?? 'cpu') as 'cpu' | 'mps',
    timeoutMs: Number(process.env.RERANKER_TIMEOUT_MS ?? 15000),
    model: model.model, revision: model.revision,
  })
}
