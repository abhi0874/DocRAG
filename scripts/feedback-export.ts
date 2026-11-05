// Local operator only. Called by the guarded Python command, never an HTTP route.
import {writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {Pool} from 'pg'
import {stableHash} from '../lib/response-cache'
import manifest from '../lib/public-cache-manifest.json'
import {readFileSync} from 'node:fs'
const pool=new Pool({connectionString:process.env.SECURITY_DATABASE_URL})
const sha=(text:string)=>createHash('sha256').update(text).digest('hex')
async function main(){
 const output=process.argv[2];if(!output)throw new Error('Output required')
 const golden=readFileSync('eval/golden_set.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line))
 const client=await pool.connect()
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await client.query("SET LOCAL statement_timeout='2000ms'")
  const rows=await client.query(`SELECT a.*,f.updated_at FROM answer_feedback f JOIN answer_receipts a ON a.id=f.answer_id AND a.owner_id=f.owner_id
   JOIN request_metrics m ON m.request_id=a.id AND m.outcome='completed' JOIN document_access x ON x.document_id=a.document_id
   WHERE f.value='down' AND x.visibility='public' AND a.public_question_hash IS NOT NULL ORDER BY a.id LIMIT 1000`)
  const candidates=[]
  for(const a of rows.rows){
   const entry=manifest.documents.find(d=>d.id===a.document_id&&d.hash===a.document_hash)
   const question=golden.find(q=>stableHash(q.question.trim())===a.public_question_hash)
   if(!entry||!question||!manifest.questions.some(q=>q.documentId===a.document_id&&q.hash===a.public_question_hash))continue
   const doc=await client.query('SELECT id,title,filename,status FROM documents WHERE id=$1',[a.document_id])
   const chunks=await client.query('SELECT id,chunk_index AS "chunkIndex",page_number AS "pageNumber",content,metadata FROM chunks WHERE document_id=$1 ORDER BY id',[a.document_id])
   if(sha(JSON.stringify({document:doc.rows[0],chunks:chunks.rows}))!==entry.hash)continue
   if(typeof a.public_answer!=='string'||sha(a.public_answer)!==a.answer_hash||!Array.isArray(a.chunk_ids)||!a.chunk_ids.every((id:unknown)=>chunks.rows.some(c=>c.id===id)))continue
   candidates.push({candidate_id:`feedback-${a.id}`,feedback_reference:a.id,question_id:question.id,question:question.question,
    answer:a.public_answer,answer_sha256:a.answer_hash,document_sha256:a.document_hash,chunk_ids:a.chunk_ids,
    prompt_version:a.prompt_version,model:a.model,model_digest:a.model_digest,feedback_updated_at:a.updated_at,
    error_category:null,review_status:'review_needed',ground_truth:false})
  }
  await client.query('COMMIT')
  writeFileSync(output,candidates.map(c=>JSON.stringify(c)).join('\n')+(candidates.length?'\n':''),{flag:'wx',mode:0o600})
  console.log(JSON.stringify({status:'PASS',candidate_count:candidates.length,private_export:false,golden_modified:false}))
 }finally{client.release()}
}
main().catch(()=>{console.error('Feedback export failed; no private details emitted');process.exitCode=1}).finally(()=>pool.end())
