import { describe, expect, it } from 'vitest'
import { requestMessages } from '@/lib/ui/chat-request'
import { chatInput } from '@/lib/security/http'
import type { RagUIMessage } from '@/lib/types'

const text = (id: string, role: 'user' | 'assistant', value: string): RagUIMessage => ({ id, role, parts: [{ type: 'text', text: value }] })

describe('native chat request after cancellation', () => {
  it('allows another question after cancellation before the first token', () => {
    const messages: RagUIMessage[] = [text('first', 'user', 'How does BEGIN work?'), { id: 'cancelled', role: 'assistant', parts: [] }, text('next', 'user', 'What ends a transaction?')]
    const result = requestMessages(messages)
    expect(result.map(message => message.id)).toEqual(['first', 'next'])
    expect(chatInput.safeParse({ documentId: 1, messages: result }).success).toBe(true)
  })
  it('omits a whitespace-only interrupted assistant response', () => {
    expect(requestMessages([text('cancelled', 'assistant', ' \n '), text('next', 'user', 'Continue?')])).toHaveLength(1)
  })
  it('preserves partial answer text and citations while stripping client metadata', () => {
    const partial: RagUIMessage = { ...text('partial', 'assistant', 'Use BEGIN [1].'), parts: [{ type: 'text', text: 'Use BEGIN [1].' }, { type: 'data-sources', data: { sources: [] } }] }
    expect(requestMessages([partial, text('next', 'user', 'And then?')])[0].parts).toEqual([{ type: 'text', text: 'Use BEGIN [1].' }])
  })
  it('keeps invalid user content visible to the existing server validator', () => {
    const messages = requestMessages([text('empty', 'user', '')])
    expect(messages).toHaveLength(1)
    expect(chatInput.safeParse({ documentId: 1, messages }).success).toBe(false)
  })
})
