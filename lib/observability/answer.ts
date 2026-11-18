import {demoEnabled,demoSettings} from '../demo-config'
import {createHash} from 'node:crypto'
import type {TextStreamPart,ToolSet} from 'ai'
import {elapsed,tokenCount,type Trace,type AnswerReceipt} from './context'
import type {DocumentSnapshot} from '../evidence'
import type {RagUIMessage} from '../types'
import type {RetrievedChunk} from '../rag'
import {localSettings,providerName} from '../provider-config'
import modelConfig from '../model-config.json'
import manifest from '../public-cache-manifest.json'
import {stableHash} from '../response-cache'

export function answerMetadata(trace:Trace|undefined,snapshot:DocumentSnapshot,messages:RagUIMessage[],sources:RetrievedChunk[],version:string){
  if(!trace)return null
  trace.provider=providerName();trace.model=trace.provider==='ollama'?localSettings().chat:demoEnabled()?demoSettings().model:modelConfig.chat
  const part=messages.length===1&&messages[0].role==='user'&&messages[0].parts.length===1?messages[0].parts[0]:null
  const hash=part?.type==='text'?stableHash(part.text.trim()):null
  // A public first document cannot authorize exporting text from a second source.
  const singleDocumentEvidence=sources.length>0 && sources.every(s=>s.documentId===snapshot.document.id)
  const publicQuestionHash=singleDocumentEvidence&&snapshot.isPublic&&trace.provider==='ollama'&&
    manifest.documents.some(d=>d.id===snapshot.document.id&&d.hash===snapshot.hash)&&
    manifest.questions.some(q=>q.documentId===snapshot.document.id&&q.hash===hash)?hash:null
  return {documentId:snapshot.document.id,documentHash:snapshot.hash,publicQuestionHash,
    chunkIds:sources.map(s=>s.id),promptVersion:version,model:trace.model,modelDigest:null} as Omit<AnswerReceipt,'answerHash'|'publicAnswer'>
}
export function cachedAnswer(trace:Trace|undefined,meta:ReturnType<typeof answerMetadata>,text:string,tokens:number|null){
  if(!trace||!meta)return
  trace.generationSkipped=true;trace.modelCallsAvoided=1;trace.tokensAvoided=tokens
  trace.modelDigest=localSettings().chatDigest
  trace.answer={...meta,modelDigest:trace.modelDigest,answerHash:createHash('sha256').update(text).digest('hex'),
    publicQuestionHash:text.length<=65536?meta.publicQuestionHash:null,publicAnswer:meta.publicQuestionHash&&text.length<=65536?text:null}
}
export function observeAnswer(stream:ReadableStream<TextStreamPart<ToolSet>>,trace:Trace|undefined,meta:ReturnType<typeof answerMetadata>){
  if(!trace||!meta)return stream
  trace.generationStart=performance.now()
  const hash=createHash('sha256');let text='',length=0,finished=false
  const reader=stream.getReader()
  const observe=(part:TextStreamPart<ToolSet>)=>{
      if(part.type==='text-delta'){
        trace.firstTokenMs??=elapsed(trace.started);hash.update(part.text);length+=part.text.length
        if(meta.publicQuestionHash&&length<=65536)text+=part.text
      }
      if(part.type==='finish'){
        finished=part.finishReason==='stop';trace.generationMs=elapsed(trace.generationStart!)
        trace.inputTokens=tokenCount(part.totalUsage?.inputTokens);trace.outputTokens=tokenCount(part.totalUsage?.outputTokens);trace.totalTokens=tokenCount(part.totalUsage?.totalTokens)
        if(!finished){trace.failed=true;trace.errorCategory='incomplete_generation'}
      }
      if(part.type==='error'||part.type==='abort'){trace.failed=true;trace.errorCategory='model'}
  }
  const finish=()=>{
      if(finished&&!trace.failed&&!trace.cancelled&&length){
        trace.modelDigest=trace.provider==='ollama'?localSettings().chatDigest:null
        trace.answer={...meta,modelDigest:trace.modelDigest,answerHash:hash.digest('hex'),
          publicQuestionHash:length<=65536?meta.publicQuestionHash:null,publicAnswer:meta.publicQuestionHash&&length<=65536?text:null}
      }else{trace.failed=true;trace.errorCategory??='incomplete_generation'}
  }
  // Explicit reader ownership keeps cancellation promises observed all the way
  // upstream. An extra pipeThrough here creates a detached rejection on abort.
  return new ReadableStream<TextStreamPart<ToolSet>>({
    async pull(controller){
      try{
        const part=await reader.read()
        if(part.done){finish();controller.close()}
        else{observe(part.value);controller.enqueue(part.value)}
      }catch(error){trace.failed=true;trace.errorCategory='model';controller.error(error)}
    },
    async cancel(reason){trace.cancelled=true;await reader.cancel(reason)},
  },{highWaterMark:0})
}

