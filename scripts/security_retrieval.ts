// Real SQL/pgvector authorization tests; invoked only against disposable test data.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {sql} from 'drizzle-orm'
import {db,pool} from '../lib/db'
import {searchStatements,retrieve} from '../lib/retrieval'
import {retrievalDefault} from '../lib/retrieval-config'
import {selectContext} from '../lib/select-context'
import {rerankerConfig} from '../lib/reranker-config'
import {documentSnapshot} from '../lib/evidence'
import {consumeLimit} from '../lib/security/limits'
import {HttpError} from '../lib/security/http'

async function main(){
  assert.match(new URL(process.env.OLLAMA_DATABASE_URL!).pathname,/^\/docrag_security_test_[a-f0-9]{12}$/)
  const fixture=JSON.parse(readFileSync('.local/security-http-fixtures.json','utf8')) as {a:string;b:string;documentA:number;documentB:number}
  const embedding=JSON.parse((await db.execute(sql`SELECT embedding::text FROM chunks WHERE document_id=${fixture.documentA} LIMIT 1`)).rows[0].embedding as string) as number[]
  let checks=0
  for(const identity of [fixture.b,null,'forged-user']){
    const statements=searchStatements('PostgreSQL transaction',fixture.documentA,embedding,retrievalDefault,identity)
    for(const query of [statements.vectorSql,statements.keywordSql,statements.combined]){
      assert.equal((await db.execute(query)).rows.length,0);checks++
    }
    assert.equal(await documentSnapshot(fixture.documentA,identity),null);checks++
    assert.deepEqual(await retrieve('PostgreSQL transaction',fixture.documentA,6,retrievalDefault,async()=>embedding,undefined,identity),[]);checks++
    const selection=await selectContext('PostgreSQL transaction',fixture.documentA,6,{...rerankerConfig(),enabled:true},retrievalDefault,undefined,identity)
    assert.equal(selection.candidates.length,0);assert.equal(selection.ranked.length,0);checks++
  }
  for(const identity of [fixture.a,fixture.b,null]){
    assert.ok(await documentSnapshot(3,identity));checks++
  }
  const own=searchStatements('PostgreSQL transaction',fixture.documentA,embedding,retrievalDefault,fixture.a)
  assert.ok((await db.execute(own.vectorSql)).rows.length);checks++
  assert.ok((await db.execute(own.keywordSql)).rows.length);checks++
  assert.ok((await retrieve('PostgreSQL transaction',fixture.documentA,6,retrievalDefault,async()=>embedding,undefined,fixture.a)).length);checks++
  // Real concurrent UPSERT quota: precisely 30 accepted, ten rejected.
  const identity='integration-quota-'+crypto.randomUUID()
  const results=await Promise.allSettled(Array.from({length:40},()=>consumeLimit('chat',identity)))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,30)
  assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason instanceof HttpError && r.reason.status===429 && (r.reason.retryAfter ?? 0)>0));checks++
  await consumeLimit('chat',identity+'-other');checks++
  await db.execute(sql`UPDATE request_limits SET reset_at=clock_timestamp()-interval '1 second' WHERE key=${'chat:'+identity}`)
  await consumeLimit('chat',identity);checks++
  console.log(JSON.stringify({status:'PASS',checks,scope:'real vector, keyword, RRF, reranker candidates, evidence and concurrent quotas'}))
}
main().catch(error=>{console.error(error instanceof assert.AssertionError ? error.message : 'Security database verification failed');process.exitCode=1}).finally(()=>pool.end())
