import {Pool} from 'pg'
import {databaseConnection} from '../provider-config'
import {elapsed,emit,type Trace} from './context'
let pool:Pool|undefined, pending=0, failures=0
function metricsPool(){
  if(!pool){
    pool=new Pool({connectionString:databaseConnection(),max:2,connectionTimeoutMillis:500,idleTimeoutMillis:10000,statement_timeout:500,query_timeout:600})
    // Idle socket errors must never become unhandled process errors or expose connection details.
    pool.on('error',()=>{failures++;process.stderr.write(JSON.stringify({timestamp:new Date().toISOString(),level:'error',event:'metrics.pool_failed',failure_count:failures})+'\n')})
  }
  return pool
}
export async function persistMetric(trace:Trace,latencyMs:number):Promise<boolean> {
  const start=performance.now()
  if(pending>=32){emit('metrics.failed',trace,{failureCount:++failures});return false}
  pending++
  try {
    const client=await metricsPool().connect()
    try {
      await client.query('BEGIN')
      const details={timings:trace.timings,first_token_ms:trace.firstTokenMs,generation_ms:trace.generationMs,model_digest:trace.modelDigest,
        generation_skipped:trace.generationSkipped,model_calls_avoided:trace.modelCallsAvoided,tokens_avoided:trace.tokensAvoided,
        estimated_api_charge_inr:trace.provider==='ollama'?0:null}
      await client.query(`INSERT INTO request_metrics(request_id,owner_id,created_at,route,method,status,outcome,latency_ms,provider,model,cache,error_category,input_tokens,output_tokens,total_tokens,details)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT(request_id) DO UPDATE SET outcome=CASE WHEN request_metrics.outcome='cancelled' THEN 'cancelled' ELSE EXCLUDED.outcome END,
        error_category=EXCLUDED.error_category`,
        [trace.id,trace.ownerId,trace.timestamp,trace.route,trace.method,trace.status,trace.outcome,latencyMs,trace.provider,trace.model,trace.cache,trace.errorCategory,trace.inputTokens,trace.outputTokens,trace.totalTokens,JSON.stringify(details)])
      const a=trace.answer
      if(trace.outcome==='completed'&&a&&trace.ownerId){
        await client.query(`INSERT INTO answer_receipts(id,owner_id,document_id,document_hash,answer_hash,public_question_hash,public_answer,chunk_ids,prompt_version,model,model_digest)
          SELECT $1,$2,d.id,$4,$5,$6,$7,$8,$9,$10,$11 FROM documents d JOIN document_access x ON x.document_id=d.id
          JOIN request_metrics m ON m.request_id=$1 WHERE d.id=$3 AND m.outcome='completed' AND (x.visibility='public' OR x.owner_id=$2)
          ON CONFLICT(id) DO NOTHING`,[trace.id,trace.ownerId,a.documentId,a.documentHash,a.answerHash,a.publicQuestionHash,a.publicAnswer,JSON.stringify(a.chunkIds),a.promptVersion,a.model,a.modelDigest])
      } else if(trace.outcome!=='completed') await client.query('DELETE FROM answer_receipts WHERE id=$1',[trace.id])
      await client.query('COMMIT')
    } catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release()}
    emit('metrics.written',trace,{durationMs:elapsed(start)});return true
  } catch {emit('metrics.failed',trace,{durationMs:elapsed(start),failureCount:++failures});return false}
  finally{pending--}
}
export async function closeMetrics(){await pool?.end();pool=undefined}
