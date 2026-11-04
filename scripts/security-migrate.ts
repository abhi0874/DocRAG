import {postgresPort} from '../lib/provider-config'
import {writeFileSync,mkdirSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {Pool} from 'pg'
import {drizzle} from 'drizzle-orm/node-postgres'
import {migrate} from 'drizzle-orm/node-postgres/migrator'
import {hashPassword} from 'better-auth/crypto'
import manifest from '../lib/public-cache-manifest.json'
const value=process.env.SECURITY_DATABASE_URL
if(!value)throw new Error('Explicit migration database required')
const url=new URL(value)
if(url.hostname!=='127.0.0.1'||url.port!==postgresPort()|| !/^\/(docrag_security_test_[a-f0-9]{12}|docrag_chunking_heading_1400_280|docrag_dev|docrag_ollama_v1)$/.test(url.pathname))throw new Error('Unapproved local migration database')
const pool=new Pool({connectionString:value})
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
async function main(){
  await migrate(drizzle(pool),{migrationsFolder:'db/security-migrations'})
  // Public classification uses exact prior verified manifest hashes, never titles.
  for(const entry of manifest.documents){
    const doc=await pool.query('SELECT id,title,filename,status FROM documents WHERE id=$1',[entry.id])
    if(!doc.rows.length)continue
    const rows=await pool.query('SELECT id,chunk_index AS "chunkIndex",page_number AS "pageNumber",content,metadata FROM chunks WHERE document_id=$1 ORDER BY id',[entry.id])
    if(hash({document:doc.rows[0],chunks:rows.rows})!==entry.hash)continue
    await pool.query("INSERT INTO document_access(document_id,visibility,provenance) VALUES($1,'public',$2) ON CONFLICT DO NOTHING",[entry.id,`step6:${entry.hash}`])
  }
  if(process.argv.includes('--test-accounts')){
    if(!/^\/docrag_security_test_/.test(url.pathname))throw new Error('Test accounts require isolated test database')
    const accounts=[]
    for(const label of ['A','B']){
      const id=randomUUID(),password=randomUUID()+'!aA9',email=`user-${label.toLowerCase()}@example.test`
      const encoded=await hashPassword(password)
      await pool.query('INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)',[id,`Test User ${label}`,email])
      await pool.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,password) VALUES($1,$2,'credential',$2,$3)",[randomUUID(),id,encoded])
      accounts.push({id,email,password})
    }
    mkdirSync('.local',{recursive:true})
    writeFileSync('.local/security-test-accounts.json',JSON.stringify(accounts),{mode:0o600})
  }
  console.log('Security migration applied; only hash-proven public documents classified')
}
main().catch(()=>{console.error('Security migration failed; inspect local configuration');process.exitCode=1}).finally(()=>pool.end())
