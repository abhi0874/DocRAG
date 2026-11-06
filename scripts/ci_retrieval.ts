/** Deterministic real PostgreSQL retrieval; creates only a fresh test-owned schema. */
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {Pool} from 'pg'
async function main(){
const value=process.env.CI_DATABASE_URL
if(!value)throw new Error('CI_DATABASE_URL required')
const url=new URL(value)
if(!['127.0.0.1','localhost','db'].includes(url.hostname)||!['/docrag_ci','/docrag_container'].includes(url.pathname))throw new Error('Dedicated CI database required')
const schema='ci_'+randomUUID().replaceAll('-','')
const admin=new Pool({connectionString:url.href})
let pool:Pool|undefined
let created=false
try{
  await admin.query(`CREATE SCHEMA "${schema}"`)
  created=true
  await admin.query(`SET search_path TO "${schema}",public`)
  await admin.query(`CREATE TABLE documents(id integer primary key);
    CREATE TABLE document_access(document_id integer,visibility text,owner_id text);
    CREATE TABLE chunks(id integer,document_id integer,content text,page_number integer,chunk_index integer,
    embedding vector(3),content_tsv tsvector GENERATED ALWAYS AS(to_tsvector('english',content)) STORED)`)
  await admin.query("INSERT INTO documents VALUES(1),(2); INSERT INTO document_access VALUES(1,'private','owner-a'),(2,'private','owner-b')")
  await admin.query("INSERT INTO chunks(id,document_id,content,page_number,chunk_index,embedding) VALUES(1,1,'BEGIN starts a transaction',1,0,'[1,0,0]'),(2,1,'COMMIT completes a transaction',1,1,'[0.9,0.1,0]'),(3,2,'BEGIN private secret',1,0,'[1,0,0]')")
  url.searchParams.set('options',`-c search_path=${schema},public`)
  process.env.AI_PROVIDER='gemini';process.env.DATABASE_URL=url.href
  const database=await import('../lib/db');pool=database.pool
  const {retrieve}=await import('../lib/retrieval')
  const {retrievalDefault}=await import('../lib/retrieval-config')
  let checks=0
  for(const mode of ['vector','keyword','hybrid'] as const){
    const config={...retrievalDefault,mode,tieBreak:'id' as const}
    const results=await retrieve('transaction',1,5,config,async()=>[1,0,0],undefined,'owner-a')
    assert.deepEqual(new Set(results.map(r=>r.id)),new Set([1,2]));checks++
    for(const principal of ['owner-b',null]){
      assert.equal((await retrieve('transaction',1,5,config,async()=>[1,0,0],undefined,principal)).length,0);checks++
    }
  }
  const {fuseRanks}=await import('../lib/rank-fusion')
  const row=(id:number)=>({id,score:1,content:'public fixture',page_number:1,chunk_index:0})
  assert.deepEqual(fuseRanks([row(2),row(1)],[row(1),row(3)],60,3,true).map(r=>r.id),[1,2,3]);checks++
  console.log(JSON.stringify({status:'PASS',checks,mode:'fixed vectors; real SQL and production RRF; no generated answers'}))
}finally{
  await pool?.end()
  if(created)await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
  await admin.end()
}

}
main().catch(()=>{console.error("CI retrieval failed (connection details withheld)");process.exitCode=1})
