/** Clean CI service only: apply actual migrations twice and preserve existing rows. */
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {Pool} from 'pg'
import {drizzle} from 'drizzle-orm/node-postgres'
import {migrate} from 'drizzle-orm/node-postgres/migrator'
async function main(){
  const url=new URL(process.env.CI_DATABASE_URL ?? '')
  if(!['localhost','127.0.0.1','db'].includes(url.hostname)||url.pathname!=='/docrag_ci'||url.search||url.hash)throw new Error('Dedicated CI database required')
  const pool=new Pool({connectionString:url.href})
  try{
    await pool.query((await readFile('db/init.sql','utf8')).replace('vector(1536)','vector(768)'))
    await migrate(drizzle(pool),{migrationsFolder:'db/security-migrations'})
    const id=randomUUID()
    await pool.query('INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)',[id,'CI fixture',`${id}@example.test`])
    await pool.query('INSERT INTO auth_session(id,token,user_id,expires_at) VALUES($1,$2,$3,now()+interval \'8 hours\')',[randomUUID(),randomUUID(),id])
    const before=(await pool.query('SELECT row_to_json(s) AS data FROM auth_session s WHERE user_id=$1',[id])).rows
    await migrate(drizzle(pool),{migrationsFolder:'db/security-migrations'})
    assert.deepEqual((await pool.query('SELECT row_to_json(s) AS data FROM auth_session s WHERE user_id=$1',[id])).rows,before)
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations')).rows[0].n,2)
    for(const table of ['documents','chunks','evaluations','document_access','request_metrics','answer_receipts','answer_feedback']){
      assert.equal((await pool.query('SELECT to_regclass($1) IS NOT NULL AS present',[table])).rows[0].present,true)
    }
    console.log('PASS: actual migrations repeat safely and preserve sessions; all required tables present')
  }finally{await pool.end()}
}
main().catch(()=>{console.error('CI migration check failed (connection details withheld)');process.exitCode=1})
