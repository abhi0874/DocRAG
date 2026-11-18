/** Real quota/retention SQL checks on an explicitly isolated native fixture DB. */
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'

async function main(){
  const url=new URL(process.env.OLLAMA_DATABASE_URL || '')
  assert(url.hostname==='127.0.0.1' && url.port==='55433' && /^\/docrag_security_test_[a-f0-9]{12}$/.test(url.pathname),'Explicit isolated test database required')
  assert(process.env.AI_PROVIDER==='ollama' && process.env.DOCRAG_DEPLOYMENT==='local')
  const output=process.argv[2]
  assert(/^\.local\/workspace-release\/[a-z0-9-]+\.json$/.test(output),'New local receipt required')
  const {pool}=await import('../lib/db')
  const checks:string[]=[]
  try {
    const identity=(await pool.query('SELECT current_database() AS name,current_user AS owner')).rows[0]
    assert.equal(identity.name,url.pathname.slice(1));assert.equal(identity.owner,'docrag')
    const before=JSON.stringify((await pool.query("SELECT c.id,c.content,c.embedding::text FROM chunks c JOIN document_access a ON a.document_id=c.document_id WHERE a.visibility='public' ORDER BY c.id")).rows)
    await pool.query(readFileSync('db/workspace.sql','utf8'))
    await pool.query(readFileSync('db/workspace.sql','utf8'))
    checks.push('additive migration repeatability on isolated fixture')
    const owner=randomUUID()
    await pool.query('INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)',[owner,'Synthetic retention',`${owner}@example.test`])
    const ids:number[]=[]
    for(const label of ['expired','future','historical']){
      const id=(await pool.query("INSERT INTO documents(title,filename,status,page_count,chunk_count) VALUES($1,$2,'ready',1,1) RETURNING id",[label,`${label}.pdf`])).rows[0].id
      ids.push(id)
      await pool.query("INSERT INTO document_access(document_id,owner_id,visibility) VALUES($1,$2,'private')",[id,owner])
      await pool.query('INSERT INTO document_files(document_id,bytes) VALUES($1,$2)',[id,Buffer.from('synthetic original')])
      await pool.query('INSERT INTO chunks(document_id,chunk_index,page_number,content,embedding) VALUES($1,0,1,$2,$3)',[id,'Synthetic retention fixture',JSON.stringify(Array(768).fill(.01))])
      if(label!=='historical')await pool.query("INSERT INTO workspace_document_policy(document_id,expires_at,consent_version) VALUES($1,clock_timestamp()+$2*interval '1 day','synthetic-test')",[id,label==='expired'?-1:1])
    }
    // The pool above remains bound to the checked native fixture. This switch
    // exercises hosted storage policy only; no model/provider module is loaded.
    process.env.DOCRAG_DEPLOYMENT='recruiter-demo';process.env.DOCRAG_WORKSPACE_ENABLED='true'
    const {checkWorkspaceCapacity,expireWorkspaceDocuments}=await import('../lib/workspace-storage')
    await assert.rejects(checkWorkspaceCapacity(owner),/storage limit/)
    checks.push('per-owner capacity rejects fourth document')
    await expireWorkspaceDocuments();await expireWorkspaceDocuments()
    for(const table of ['documents','chunks','document_files','document_access','workspace_document_policy']){
      const column=table==='documents'?'id':'document_id'
      assert.equal(Number((await pool.query(`SELECT count(*) AS n FROM ${table} WHERE ${column}=$1`,[ids[0]])).rows[0].n),0)
    }
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM documents WHERE id=ANY($1::int[])',[ids.slice(1)])).rows[0].n),2)
    await checkWorkspaceCapacity(owner)
    checks.push('expiry removes only tagged expired data; future and historical data survive')
    const {consumeLimit}=await import('../lib/security/limits')
    const quota=await Promise.allSettled(Array.from({length:20},()=>consumeLimit('workspaceUploadUser',owner)))
    assert.equal(quota.filter(r=>r.status==='fulfilled').length,2)
    assert(quota.filter(r=>r.status==='rejected').every(r=>r.reason.status===429 && r.reason.retryAfter>0))
    checks.push('20 concurrent upload admissions allow exactly two')
    const bytes=await Promise.allSettled(Array.from({length:3},()=>consumeLimit('embeddingBytes',owner,5000)))
    assert.equal(bytes.filter(r=>r.status==='fulfilled').length,2)
    checks.push('weighted embedding budget rejects oversubscription')
    const after=JSON.stringify((await pool.query("SELECT c.id,c.content,c.embedding::text FROM chunks c JOIN document_access a ON a.document_id=c.document_id WHERE a.visibility='public' ORDER BY c.id")).rows)
    assert.equal(after,before);checks.push('public corpus and vectors byte-identical')
    writeFileSync(output,JSON.stringify({status:'PASS',scope:'real native SQL; not live Gemini',database:identity.name,checks},null,2),{flag:'wx'})
    console.log(JSON.stringify({status:'PASS',checks:checks.length}))
  }finally{await pool.end()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Storage verification failed');process.exitCode=1})
