import {z} from 'zod'
import type {TextStreamPart,ToolSet} from 'ai'
import type {RetrievedChunk} from './rag'

export const insufficientEvidence = 'I could not find this in the document.'
export const evidenceProtocol = `Response format: when evidence supports an answer, your response has TWO mandatory parts. The JSON assessment alone is not an answer. Closing its final brace does not end your response.
Part 1: one compact JSON line with support ("full" or "partial") and evidence. Each evidence item has ONLY citation and quote. Use one or two exact contiguous quotes of 8–120 characters from the supplied excerpts. Copy a short phrase within a SINGLE source line, preserving its spelling, spacing and punctuation exactly. Never join source lines with spaces, paraphrase a quotation or combine separate sentences. Source JSON escapes encode the original text; they are not permission to normalize it. Do not copy source metadata or entire input evidence objects.
Part 2: after a newline, answer the user's actual question in plain text, at most 120 words, citing each factual claim with the assigned excerpt number. After the JSON line you MUST write this substantive answer; do not repeat the assessment or merely list excerpts.
Complete supported-response format (angle-bracketed placeholders describe content to supply, not text to copy):
{"support":"full","evidence":[{"citation":1,"quote":"<short exact quote from excerpt 1>"}]}
<Your grounded answer to the user's question, with a citation [1].>
Use "full" only if every requested fact is supported. Use "partial" if only some requested facts are supported; answer those facts and explicitly identify the missing information. Resolve references using conversation history without treating previous answers as evidence. Select excerpts that support the question, not merely share its topic. For a summary, evidence about the document's main subject is sufficient. Never infer absent numbers, dates, names, causes or conclusions.
Only if NO supplied excerpt supports an answer, return exactly {"support":"none","evidence":[]} with no second part. This exception must not be used for supported questions. The application validates the assessment and exact quotes before showing the answer.`

const assessment=z.object({support:z.enum(['full','partial','none']),evidence:z.array(z.object({citation:z.number().int().positive(),quote:z.string().min(8).max(300)}).strict()).max(6)}).strict()
export function validateAssessment(line:string,sources:RetrievedChunk[]) {
  let value:unknown
  try {value=JSON.parse(line)} catch(error) {
    // The preserved local model sometimes repeats only the final closing brace.
    // Accept that one unambiguous framing defect; all fields and exact quotes
    // still pass the same strict schema/evidence checks below. No other repair.
    if(!(error instanceof SyntaxError)||!line.endsWith('}}'))throw error
    value=JSON.parse(line.slice(0,-1))
  }
  const parsed=assessment.parse(value)
  if(parsed.support==='none') {
    if(parsed.evidence.length)throw new Error('Inconsistent evidence assessment')
  } else if(!parsed.evidence.length || parsed.evidence.some(e=>!sources[e.citation-1]?.content.includes(e.quote))) throw new Error('Evidence assessment could not be verified')
  return parsed
}

/** Consume the evidence header before forwarding any generated answer text. */
export class IncompleteGenerationError extends Error {
  constructor(){super('The answer was incomplete. Please try again.');this.name='IncompleteGenerationError'}
}
// Ollama can serialize the separator as literal backslash-n. Recognize it only
// outside the complete first JSON object, never inside an evidence quote.
function assessmentBoundary(text:string) {
  let depth=0,quoted=false,escaped=false
  if(!text.trimStart().startsWith('{'))return -1
  for(let i=0;i<text.length;i++) {
    const char=text[i]
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
    if(char==='"')quoted=true
    else if(char==='{')depth++
    else if(char==='}'&&--depth===0){
      const end=text[i+1]==='}'?i+2:i+1
      return text.slice(end,end+2)==='\\n'?end:-1
    }
  }
  return -1
}
export function evidenceCheckedStream(stream:ReadableStream<TextStreamPart<ToolSet>>,sources:RetrievedChunk[]) {
  let header='',checked=false,refused=false,textId='answer',hasAnswer=false,finished=false,failed=false
  return stream.pipeThrough(new TransformStream<TextStreamPart<ToolSet>,TextStreamPart<ToolSet>>({
    transform(part,controller){
      if(part.type==='text-start')textId=part.id
      if(part.type==='error'||part.type==='abort')failed=true
      if(part.type==='text-delta') {
        if(refused)return
        if(checked){hasAnswer ||= !!part.text.trim();controller.enqueue(part);return}
        header+=part.text
        const boundary=assessmentBoundary(header)
        if(boundary>=0)header=header.slice(0,boundary)+'\n'+header.slice(boundary+2)
        const newline=header.indexOf('\n')
        if(newline<0){if(header.length>4096)throw new Error('Evidence assessment exceeded its limit');return}
        const data=validateAssessment(header.slice(0,newline).trim(),sources)
        checked=true;refused=data.support==='none'
        hasAnswer=!!header.slice(newline+1).trim()
        controller.enqueue({...part,text:refused?insufficientEvidence:header.slice(newline+1)})
        header='';return
      }
      if(part.type==='text-end' && !checked && header.trim()) {
        const data=validateAssessment(header.trim(),sources)
        if(data.support!=='none')throw new IncompleteGenerationError()
        checked=true;refused=true;controller.enqueue({type:'text-delta',id:textId,text:insufficientEvidence})
      }
      if(part.type==='finish') {
        if(!failed && (part.finishReason!=='stop'||!checked||(!refused&&!hasAnswer)))throw new IncompleteGenerationError()
        finished=true
      }
      controller.enqueue(part)
    },
    flush(){if(!failed&&!finished)throw new IncompleteGenerationError()},
  }))
}
