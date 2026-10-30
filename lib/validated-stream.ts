import type { TextStreamPart, ToolSet } from 'ai'
import { validateCitations } from './citations'

/** Observe completion without buffering delivery. Cancellation/error cannot run commit. */
export function validatedStream(stream: ReadableStream<TextStreamPart<ToolSet>>, count: number,
  signal: AbortSignal, onValid: (answer: {text: string; tokens: number | null}) => Promise<void>,
  onValidation: (result: ReturnType<typeof validateCitations>) => void, onRelease: () => void) {
  let text = '', finished = false, failed = false, tokens: number | null = null
  const release = () => onRelease()
  signal.addEventListener('abort', release, {once: true})
  return stream.pipeThrough(new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
    transform(part, controller) {
      if (part.type === 'text-delta') text += part.text
      if (part.type === 'finish') {finished = part.finishReason === 'stop'; tokens = part.totalUsage.totalTokens ?? null}
      if (part.type === 'error' || part.type === 'abort') {failed = true; release()}
      controller.enqueue(part)
    },
    async flush() {
      try {
        const result = validateCitations(text, count)
        onValidation(result)
        if (finished && !failed && !signal.aborted && result.valid) await onValid({text, tokens})
      } finally {signal.removeEventListener('abort', release); release()}
    },
  }), {signal})
}
