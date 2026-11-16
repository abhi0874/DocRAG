import type { RagUIMessage } from '@/lib/types'

/** Keep text history, excluding the empty assistant shell left by an early stop. */
export function requestMessages(messages: RagUIMessage[]) {
  return messages.flatMap(message => {
    const text = message.parts.filter(part => part.type === 'text').map(part => part.text).join(' ')
    if (message.role === 'assistant' && !text.trim()) return []
    return [{ id: message.id, role: message.role, parts: [{ type: 'text' as const, text }] }]
  })
}
