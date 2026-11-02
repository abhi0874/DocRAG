import { createHash } from 'node:crypto'

export function stableHash(value: unknown): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical)
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v)
      .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, item]) => [k, canonical(item)]))
    return v
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
export interface CacheIdentity {
  question: string
  scope: string
  documentId: number
  documentHash: string
  context: unknown
  retrieval: unknown
  reranker: unknown
  model: unknown
  prompt: unknown
  history: unknown
}
export const responseKey = (identity: CacheIdentity) => stableHash({...identity, question: identity.question.trim()})
export interface CachedAnswer {text: string; tokens: number | null}
interface Entry {answer: CachedAnswer; scope: string; documentId: number; expires: number; bytes: number}

/** Process-local LRU; no private documents, persistent storage or external service. */
export class ResponseCache {
  private entries = new Map<string, Entry>()
  private pending = new Set<string>()
  private bytes = 0
  constructor(readonly maxEntries = 128, readonly maxBytes = 8 * 1024 * 1024,
    readonly ttlMs = 300000, readonly now = () => Date.now()) {}
  private remove(key: string) {
    const entry = this.entries.get(key)
    if (entry) {this.bytes -= entry.bytes; this.entries.delete(key)}
  }
  get(key: string, scope: string, accept?: (answer: CachedAnswer) => boolean) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= this.now()) {this.remove(key); return undefined}
    if (entry.scope !== scope) return undefined
    if (accept && !accept(entry.answer)) {this.remove(key); return undefined}
    this.entries.delete(key); this.entries.set(key, entry)
    return {...entry.answer}
  }
  acquire(key: string) {
    if (this.pending.has(key) || this.pending.size >= this.maxEntries) return false
    this.pending.add(key); return true
  }
  release(key: string) {this.pending.delete(key)}
  set(key: string, scope: string, documentId: number, answer: CachedAnswer) {
    const bytes = Buffer.byteLength(answer.text) + Buffer.byteLength(key) + Buffer.byteLength(scope) + 128
    if (!answer.text.trim() || bytes > this.maxBytes) return false
    for (const [k, entry] of this.entries) if (entry.expires <= this.now()) this.remove(k)
    this.remove(key)
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) this.remove(this.entries.keys().next().value!)
    this.entries.set(key, {scope, documentId, answer: {...answer}, bytes, expires: this.now() + this.ttlMs})
    this.bytes += bytes; return true
  }
  invalidateDocument(documentId: number) {
    for (const [key, entry] of this.entries) if (entry.documentId === documentId) this.remove(key)
  }
  get size() {return this.entries.size}
}
export const responseCache = new ResponseCache()
