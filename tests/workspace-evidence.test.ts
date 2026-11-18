import {expect,it} from 'vitest'
import {validateAssessment,evidenceCheckedStream,insufficientEvidence} from '@/lib/workspace-evidence'
import type {TextStreamPart,ToolSet} from 'ai'
const sources=[{id:1,content:'Project Cedar launched on 12 March 2025. Its target is reducing water waste.',pageNumber:1,chunkIndex:0,vectorScore:.5,keywordScore:.1,rrfScore:.03}]
it('requires exact evidence for full and partial claims',()=>{
  for(const support of ['full','partial'])expect(validateAssessment(JSON.stringify({support,evidence:[{citation:1,quote:'Project Cedar launched on 12 March 2025.'}]}),sources).support).toBe(support)
})
it.each([{support:'full',evidence:[]},{support:'full',evidence:[{citation:2,quote:'Project Cedar'}]},{support:'full',evidence:[{citation:1,quote:'invented document quote'}]},{support:'none',evidence:[{citation:1,quote:'Project Cedar'}]}])('rejects unsupported assessment %j',assessment=>expect(()=>validateAssessment(JSON.stringify(assessment),sources)).toThrow())
async function read(parts:string[]) {
  const stream=new ReadableStream<TextStreamPart<ToolSet>>({start(c){c.enqueue({type:'text-start',id:'a'});parts.forEach(text=>c.enqueue({type:'text-delta',id:'a',text}));c.enqueue({type:'text-end',id:'a'});c.enqueue({type:'finish',finishReason:'stop',totalUsage:{totalTokens:5}} as TextStreamPart<ToolSet>);c.close()}})
  let text='';const reader=evidenceCheckedStream(stream,sources).getReader()
  while(true){const {value:part,done}=await reader.read();if(done)break;if(part.type==='text-delta')text+=part.text}return text
}
it('handles fragmented evidence headers and streams only the answer',async()=>expect(await read(['{"support":"fu','ll","evidence":[{"citation":1,"quote":"Project Cedar"}]}\n','Cedar launched in March [1].'])).toBe('Cedar launched in March [1].'))
it.each(['\nInvented claim [1].',''])('turns unsupported assessment into an uncited refusal, ignoring any invented continuation',async suffix=>expect(await read(['{"support":"none","evidence":[]}'+suffix])).toBe(insufficientEvidence))
it('reports malformed generation as an error rather than pretending evidence is absent',async()=>{await expect(read(['This is not valid assessment JSON.'])).rejects.toThrow()})
it('handles a fragmented literal newline only after the evidence object closes',async()=>{
 const header='{"support":"full","evidence":[{"citation":1,"quote":"Project Cedar"}]}'
 expect(await read([header+'\\','nCedar launched in March [1].'])).toBe('Cedar launched in March [1].')
 await expect(read([header+'\\n'])).rejects.toThrow('incomplete')
})
it('does not rewrite escapes inside quotes or accept same-line prose without a separator',async()=>{
 const header='{"support":"full","evidence":[{"citation":1,"quote":"Project\\nCedar"}]}'
 await expect(read([header+'\\nCedar launched [1].'])).rejects.toThrow('Evidence assessment')
 await expect(read(['{"support":"full","evidence":[{"citation":1,"quote":"Project Cedar"}]}Cedar launched [1].'])).rejects.toThrow()
})
it('tolerates only one redundant final brace while preserving exact evidence checks',()=>{
  const valid=JSON.stringify({support:'full',evidence:[{citation:1,quote:'Project Cedar'}]})
  expect(validateAssessment(valid+'}',sources).support).toBe('full')
  for(const line of [valid+'}}',valid+' ignored',valid.replace('Project Cedar','Fabricated quote')+'}'])expect(()=>validateAssessment(line,sources)).toThrow()
})
it('rejects the two FastAPI quotes with flattened line breaks, preserving literal source bytes',()=>{
 const cases=[
  ['Validate the data.\nIf the data is invalid, it will return a nice and clear error','Validate the data. If the data is invalid, it will return a nice and clear error','Validate the data.'],
  ["FastAPI gives you data validation.\nNotice that the error also clearly states exactly the point where the validation didn't pass","FastAPI gives you data validation. Notice that the error also clearly states exactly the point where the validation didn't pass",'FastAPI gives you data validation.'],
 ]
 for(const [content,flattened,exact] of cases){
  const passage=[{...sources[0],content}]
  const line=(quote:string)=>JSON.stringify({support:'full',evidence:[{citation:1,quote}]})
  expect(()=>validateAssessment(line(flattened),passage)).toThrow('Evidence assessment')
  expect(validateAssessment(line(exact),passage).evidence[0].quote).toBe(exact)
  expect(validateAssessment(line(content),passage).evidence[0].quote).toBe(content)
 }
})
