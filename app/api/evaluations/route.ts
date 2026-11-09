import {rejectDemoWrite} from '@/lib/demo-access'
import {currentTrace,measure,tokenCount} from '@/lib/observability/context'
import {providerName,localSettings} from '@/lib/provider-config'
import modelConfig from '@/lib/model-config.json'
import {observed} from '@/lib/observability/http'
import {generateText} from 'ai'
import {and,desc,eq,sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {evaluations} from '@/lib/db/schema'
import {evaluationAccess} from '@/lib/db/security-schema'
import {CHAT_MODEL} from '@/lib/rag'
import {answerInstructions} from '@/lib/rag-prompt'
import {documentSnapshot,withEvidenceMetadata} from '@/lib/evidence'
import {validateCitations} from '@/lib/citations'
import {selectContext} from '@/lib/select-context'
import {documentScope} from '@/lib/security/access'
import {checkOrigin,principal,jsonBody,evaluationInput,safeError,HttpError} from '@/lib/security/http'
import {consumeLimit} from '@/lib/security/limits'
import {acquireWork} from '@/lib/security/work'
export const maxDuration=120
async function handleGET(req:Request){
  try{
    const userId=(await principal(req))!;await consumeLimit('read',userId)
    const rows=await db.select({evaluation:evaluations}).from(evaluations)
      .innerJoin(evaluationAccess,eq(evaluationAccess.evaluationId,evaluations.id))
      .where(and(eq(evaluationAccess.ownerId,userId),documentScope(sql`evaluations.document_id`,userId)))
      .orderBy(desc(evaluations.createdAt)).limit(20)
    return Response.json(rows.map(row=>row.evaluation),{headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}
}
async function handlePOST(req:Request){
  let release:(()=>void)|undefined
  try{
    rejectDemoWrite()
    checkOrigin(req);const userId=(await principal(req))!;await consumeLimit('evaluation',userId)
    const {documentId,question}=await jsonBody(req,evaluationInput)
    const snapshot=await measure('authorization',()=>documentSnapshot(documentId,userId))
    if(!snapshot)throw new HttpError(404,'Document unavailable')
    release=acquireWork()
    const trace=currentTrace()
    if(trace){trace.provider=providerName();trace.model=trace.provider==='ollama'?localSettings().chat:modelConfig.chat;trace.cache='BYPASS'}
    const selection=await measure('retrieval',()=>selectContext(question,documentId,6,undefined,undefined,t=>{if(trace)Object.assign(trace.timings,t)},userId))
    const retrieved=withEvidenceMetadata(selection.ranked,snapshot)
    const signal=AbortSignal.any([req.signal,AbortSignal.timeout(120000)])
    const generationStart=performance.now()
    const [ragResult,noRagResult]=await Promise.all([
      generateText({model:CHAT_MODEL,instructions:answerInstructions(retrieved),prompt:question,abortSignal:signal}),
      generateText({model:CHAT_MODEL,instructions:'Answer the question from your general knowledge only. Be concise. If you are unsure or the question refers to a specific document you cannot see, say so honestly.',prompt:question,abortSignal:signal}),
    ])
    if(trace){
      trace.generationMs=performance.now()-generationStart
      trace.modelDigest=trace.provider==='ollama'?localSettings().chatDigest:null
      for(const key of ['inputTokens','outputTokens','totalTokens'] as const){
        const a=tokenCount(ragResult.totalUsage?.[key]),b=tokenCount(noRagResult.totalUsage?.[key])
        trace[key]=a!==null&&b!==null?tokenCount(a+b):null
      }
    }
    const after=await documentSnapshot(documentId,userId)
    if(after?.hash!==snapshot.hash)throw new HttpError(409,'Document changed; retry')
    const saved=await db.transaction(async tx=>{
      const [row]=await tx.insert(evaluations).values({documentId,question,ragAnswer:ragResult.text,noRagAnswer:noRagResult.text,retrievedChunks:retrieved}).returning()
      await tx.insert(evaluationAccess).values({evaluationId:row.id,ownerId:userId});return row
    })
    return Response.json({...saved,reranking:selection.trace,citationValidation:validateCitations(ragResult.text,retrieved.length)},
      {headers:{'Cache-Control':'no-store'}})
  }catch(error){return safeError(error)}finally{release?.()}
}

export const GET=observed('/api/evaluations',handleGET)
export const POST=observed('/api/evaluations',handlePOST)
