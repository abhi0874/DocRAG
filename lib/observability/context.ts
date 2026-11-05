import {AsyncLocalStorage} from 'node:async_hooks'
import {randomUUID} from 'node:crypto'

export type Outcome='completed'|'failed'|'cancelled'
export type Stage='authentication'|'validation'|'authorization'|'retrieval'|'context'|'model_start'
export type AnswerReceipt={documentId:number;documentHash:string;answerHash:string;publicQuestionHash:string|null;publicAnswer:string|null;chunkIds:number[];promptVersion:string;model:string;modelDigest:string|null}
export interface Trace {
  id:string;route:string;method:string;started:number;timestamp:Date;ownerId:string|null
  timings:Record<string,number|null>;status:number;outcome:Outcome;errorCategory:string|null
  provider:string|null;model:string|null;modelDigest:string|null;cache:string|null
  inputTokens:number|null;outputTokens:number|null;totalTokens:number|null
  generationSkipped:boolean;modelCallsAvoided:number;tokensAvoided:number|null
  firstTokenMs:number|null;generationStart:number|null;generationMs:number|null
  failed:boolean;cancelled:boolean;answer?:AnswerReceipt
}
const storage=new AsyncLocalStorage<Trace>()
export const currentTrace=()=>storage.getStore()
export const withTrace=<T>(trace:Trace,fn:()=>T)=>storage.run(trace,fn)
export function newTrace(route:string,method:string):Trace {
  return {id:randomUUID(),route,method,started:performance.now(),timestamp:new Date(),ownerId:null,timings:{},status:500,outcome:'failed',errorCategory:null,
    provider:null,model:null,modelDigest:null,cache:null,inputTokens:null,outputTokens:null,totalTokens:null,generationSkipped:false,modelCallsAvoided:0,tokensAvoided:null,
    firstTokenMs:null,generationStart:null,generationMs:null,failed:false,cancelled:false}
}
export const elapsed=(start:number)=>Math.max(0,performance.now()-start)
export const tokenCount=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null
export function errorCategory(status:number){return status===401?'authentication':status===403?'origin':status===404?'unavailable':status===429?'rate_limit':status>=500?'internal':'invalid_input'}
// Strict output allowlist: no request/response objects, arbitrary errors, user IDs,
// document names, headers, prompts or model text ever reach this serializer.
export function logRecord(event:'request.started'|'stage.finished'|'request.finished'|'metrics.written'|'metrics.failed',trace:Trace,extra:{stage?:Stage;durationMs?:number;failureCount?:number}={}) {
  return {timestamp:new Date().toISOString(),level:event==='metrics.failed'||trace.failed?'error':'info',event,
    request_id:trace.id,route:trace.route,method:trace.method,
    ...(event==='request.finished'?{status:trace.status,completion:trace.outcome,latency_ms:elapsed(trace.started),error_category:trace.errorCategory,provider:trace.provider,cache:trace.cache}:{}),
    ...(extra.stage?{stage:extra.stage}:{}),...(extra.durationMs!==undefined?{duration_ms:extra.durationMs}:{}),...(extra.failureCount!==undefined?{failure_count:extra.failureCount}:{})}
}
export function emit(event:Parameters<typeof logRecord>[0],trace:Trace,extra?:Parameters<typeof logRecord>[2]) {
  try {if(process.stdout.writableLength<262144)process.stdout.write(JSON.stringify(logRecord(event,trace,extra))+'\n')} catch { /* logging cannot break an application response */ }
}
export async function measure<T>(stage:Stage,fn:()=>Promise<T>):Promise<T> {
  const trace=currentTrace();if(!trace)return fn()
  const start=performance.now()
  try{return await fn()}catch(error){
    if(stage==='retrieval'||stage==='model_start'){trace.failed=true;trace.errorCategory=stage==='retrieval'?'retrieval':'model'}
    throw error
  }finally{const ms=elapsed(start);trace.timings[stage]=ms;emit('stage.finished',trace,{stage,durationMs:ms})}
}
