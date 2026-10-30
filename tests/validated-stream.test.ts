import {expect,it,vi} from 'vitest'
import type {TextStreamPart,ToolSet} from 'ai'
import {validatedStream} from '@/lib/validated-stream'

const finish = {type:'finish',finishReason:'stop',totalUsage:{totalTokens:20}} as TextStreamPart<ToolSet>
const text = (value: string) => ({type:'text-delta',id:'a',text:value} as TextStreamPart<ToolSet>)
async function run(parts: TextStreamPart<ToolSet>[], abort = false) {
  const controller = new AbortController();const commit=vi.fn(async () => {}), validation=vi.fn(), release=vi.fn()
  const input = new ReadableStream<TextStreamPart<ToolSet>>({start(c){parts.forEach(p=>c.enqueue(p));c.close()}})
  if(abort) controller.abort()
  const output=validatedStream(input,1,controller.signal,commit,validation,release)
  try {const reader=output.getReader(); while (!(await reader.read()).done) { /* Drain the observed stream. */ }} catch { /* Expected abort rejection is asserted below. */ }
  return {commit,validation,release}
}
it('stores only completed structurally valid answers with actual token usage',async()=>{
  const r=await run([text('Supported [1].'),finish]);expect(r.commit).toHaveBeenCalledWith({text:'Supported [1].',tokens:20})
})
it.each([
  [text('Partial')],
  [text('Wrong [99]'),finish],
  [text('Failed [1]'),{type:'error',error:new Error('failure')} as TextStreamPart<ToolSet>,finish],
  [text('Truncated [1]'),{...finish,finishReason:'length'} as TextStreamPart<ToolSet>],
])('never stores failed, incomplete, truncated or invalid responses',async (...parts)=>{
  const r=await run(parts);expect(r.commit).not.toHaveBeenCalled()
})
it('never stores an aborted stream',async()=>{const r=await run([text('Answer [1]'),finish],true);expect(r.commit).not.toHaveBeenCalled()})
it('does not store a stream cancelled after a partial chunk',async()=>{
  const commit=vi.fn(async()=>{}),controller=new AbortController()
  const source=new ReadableStream<TextStreamPart<ToolSet>>({start(c){c.enqueue(text('partial'))}})
  const output=validatedStream(source,1,controller.signal,commit,()=>{},()=>{})
  const reader=output.getReader();await reader.read();controller.abort();await reader.cancel().catch(()=>{})
  expect(commit).not.toHaveBeenCalled()
})
