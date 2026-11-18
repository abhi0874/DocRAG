import {expect,it,vi} from 'vitest'
import type {TextStreamPart,ToolSet} from 'ai'
import {evidenceCheckedStream,insufficientEvidence} from '@/lib/workspace-evidence'
import {validateCitations} from '@/lib/citations'
type Part=TextStreamPart<ToolSet>
const sources=[{id:1,content:'Public transactions become visible together after COMMIT.',pageNumber:1,chunkIndex:0,vectorScore:1,keywordScore:1,rrfScore:1}]
const header='{"support":"full","evidence":[{"citation":1,"quote":"transactions become visible together"}]}'
const end={type:'text-end',id:'a'} as Part
const finish=(reason='stop')=>({type:'finish',finishReason:reason,totalUsage:{totalTokens:20}} as Part)
const delta=(text:string)=>({type:'text-delta',id:'a',text} as Part)
async function read(parts:Part[]) {
 const source=new ReadableStream<Part>({start(c){c.enqueue({type:'text-start',id:'a'});for(const p of parts)c.enqueue(p);c.close()}})
 const reader=evidenceCheckedStream(source,sources).getReader();let text=''
 while(true){const r=await reader.read();if(r.done)break;if(r.value.type==='text-delta')text+=r.value.text}
 return text
}
it('streams the answer after a fragmented header and validates citations',async()=>{
 const text=await read([delta(header.slice(0,20)),delta(header.slice(20)+'\nChanges become visible together [1].'),end,finish()])
 expect(text).toBe('Changes become visible together [1].');expect(validateCitations(text,1).valid).toBe(true)
})
it.each([header,header+'\n',header+'\n \t\n',''])('rejects header-only or empty completion without inventing a refusal: %j',async text=>{
 await expect(read([delta(text),end,finish()])).rejects.toThrow()
})
it.each(['length','content-filter','error','unknown'])('rejects incomplete finish %s even if partial text has citations',async reason=>{
 await expect(read([delta(header+'\nChanges become visible together [1].'),end,finish(reason)])).rejects.toThrow()
})
it('rejects an EOF without finalization',async()=>{
 await expect(read([delta(header+'\nChanges become visible together [1].'),end])).rejects.toThrow()
})
it('keeps an actual insufficient-evidence result distinct from a provider failure',async()=>{
 expect(await read([delta('{"support":"none","evidence":[]}'),end,finish()])).toBe(insufficientEvidence)
 await expect(read([delta('{"support":"none","evidence":[]}'),end,finish('length')])).rejects.toThrow()
})
it('forwards a provider error without replacing it with a refusal',async()=>{
 const parts:Part[]=[]
 const source=new ReadableStream<Part>({start(c){c.enqueue({type:'error',error:new Error('provider unavailable')});c.close()}})
 const reader=evidenceCheckedStream(source,sources).getReader()
 while(true){const r=await reader.read();if(r.done)break;parts.push(r.value)}
 expect(parts).toHaveLength(1);expect(parts[0].type).toBe('error')
})
it('propagates cancellation upstream without fabricating a completion',async()=>{
 const cancel=vi.fn()
 const source=new ReadableStream<Part>({pull(c){c.enqueue(delta(header+'\nPartial answer [1].'))},cancel})
 const reader=evidenceCheckedStream(source,sources).getReader();await reader.read();await reader.cancel('test cancel')
 await vi.waitFor(()=>expect(cancel).toHaveBeenCalledOnce())
})
