/** Evaluation-only pacing, including every HTTP attempt made by SDK retries. */
export function generationPacer(options: {
  intervalMs: number
  readLast: () => number
  writeLast: (at: number) => void
  now: () => number
  sleep: (ms: number) => Promise<void>
}) {
  return async (url: URL) => {
    if (url.hostname !== 'generativelanguage.googleapis.com' ||
        !/:(generateContent|streamGenerateContent)$/.test(url.pathname)) return false
    const delay = Math.max(0, options.intervalMs - (options.now() - options.readLast()))
    if (delay) await options.sleep(delay)
    options.writeLast(options.now())
    return true
  }
}
