/** Preserve provider stream errors instead of masking them with missing-output errors. */
export async function consumeAnswer(stream: {
  text: PromiseLike<string>
  totalUsage: PromiseLike<unknown>
  finishReason: PromiseLike<unknown>
  stream: AsyncIterable<{ type: string; error?: unknown }>
}) {
  let streamError: unknown
  const observe = (async () => {
    for await (const part of stream.stream) {
      if (part.type === 'error') streamError = part.error ?? new Error('Answer stream failed')
    }
  })()
  try {
    const [text, usage, finishReason] = await Promise.all([
      stream.text, stream.totalUsage, stream.finishReason, observe,
    ])
    if (streamError !== undefined) throw streamError
    return { text, usage, finishReason }
  } catch (error) {
    // Stream observation can finish after the SDK's result promises reject.
    await observe.catch(observationError => { streamError ??= observationError })
    throw streamError ?? error
  }
}
