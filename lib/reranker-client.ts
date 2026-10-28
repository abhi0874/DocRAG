import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import type { RerankerConfig } from './reranker-config'

export interface ScoreResult {
  scores: number[]
  device: string
  inference_ms: number
  initialization_ms: number
  truncated: number
  peak_rss_bytes: number
  mps_allocated_bytes: number | null
}

/** One local child per Node process; stdin EOF terminates it when the owner exits. */
class Worker {
  child?: ChildProcessWithoutNullStreams
  pending?: {id: number; resolve: (r: ScoreResult) => void; reject: (e: Error) => void}
  sequence = 0
  busy = false
  idle?: NodeJS.Timeout
  constructor(readonly device: string) {}
  stop(reason = 'worker_stopped') {
    clearTimeout(this.idle)
    this.pending?.reject(new Error(reason)); this.pending = undefined
    const child = this.child; this.child = undefined
    child?.stdin.end(); child?.kill()
  }
  start() {
    const root = process.cwd()
    // Host-installed optional runtime: configured when launching the server,
    // not a project-relative asset for Next.js to discover and bundle.
    const target = process.env.DOCRAG_RERANKER_HOME
    if (!target || !path.isAbsolute(target)) throw new Error('model_missing')
    const python = path.join(target, 'env/bin/python')
    const manifest = path.join(target, 'manifest.json')
    if (!existsSync(python) || !existsSync(manifest)) throw new Error('model_missing')
    // Do not pass database/API credentials into the optional inference child.
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV, LANG: 'en_US.UTF-8', PYTHONNOUSERSITE: '1',
      HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1',
    }
    for (const [key, relative] of Object.entries({
      HF_HOME: 'cache/huggingface', TORCH_HOME: 'cache/torch',
      SENTENCE_TRANSFORMERS_HOME: 'cache/sentence-transformers', XDG_CACHE_HOME: 'cache',
      PIP_CACHE_DIR: 'cache/pip', TMPDIR: 'tmp', PYTHONPYCACHEPREFIX: 'cache/pycache',
    })) env[key] = path.join(target, relative)
    const child = spawn(python, ['-m', 'scripts.reranker_worker', this.device], {cwd: root, env, stdio: 'pipe'})
    this.child = child
    const lines = createInterface({input: child.stdout})
    child.stderr.resume() // Worker errors use fixed safe codes, never model/library stderr.
    lines.on('line', line => {
      if (this.child !== child) return
      try {
        const result = JSON.parse(line)
        if (!this.pending || result.id !== this.pending.id || result.error) throw new Error('inference_failed')
        this.pending.resolve(result); this.pending = undefined
      } catch { this.stop('invalid_worker_response') }
    })
    child.on('error', () => { if (this.child === child) this.stop('worker_unavailable') })
    child.on('exit', () => { lines.close(); if (this.child === child) this.stop('worker_exited') })
  }
  async score(query: string, passages: string[], timeoutMs: number): Promise<ScoreResult> {
    // Bound concurrent load: another request uses the documented hybrid fallback.
    if (this.busy) throw new Error('worker_busy')
    this.busy = true; clearTimeout(this.idle)
    let timer: NodeJS.Timeout | undefined
    try {
      if (!this.child) this.start()
      return await new Promise<ScoreResult>((resolve, reject) => {
        const id = ++this.sequence
        this.pending = {id, resolve, reject}
        timer = setTimeout(() => this.stop('timeout'), timeoutMs)
        this.child!.stdin.write(JSON.stringify({id, query, passages}) + '\n', error => {
          if (error) this.stop('worker_unavailable')
        })
      })
    } finally {
      clearTimeout(timer); this.busy = false
      this.idle = setTimeout(() => this.stop(), 60000); this.idle.unref()
    }
  }
}
const workers = new Map<string, Worker>()
export function closeRerankers() { for (const worker of workers.values()) worker.stop(); workers.clear() }
export function scorePassages(query: string, passages: string[], config: RerankerConfig) {
  if (!workers.has(config.device)) workers.set(config.device, new Worker(config.device))
  return workers.get(config.device)!.score(query, passages, config.timeoutMs)
}
