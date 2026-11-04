import {randomUUID} from 'node:crypto'
import {hashPassword} from 'better-auth/crypto'
import {Pool} from 'pg'
import {databaseConnection} from '../lib/provider-config'
import {z} from 'zod'
async function main(){
  let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>4096)throw new Error('Input too large')}
  const {name,email,password}=z.object({name:z.string().min(1).max(100),email:z.email().max(254),password:z.string().min(12).max(128)}).strict().parse(JSON.parse(input))
  const pool=new Pool({connectionString:databaseConnection()});const client=await pool.connect()
  try{const id=randomUUID(),encoded=await hashPassword(password);await client.query('BEGIN')
    await client.query('INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)',[id,name,email.toLowerCase()])
    await client.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,password) VALUES($1,$2,'credential',$2,$3)",[randomUUID(),id,encoded])
    await client.query('COMMIT');console.log('Account created')
  }catch{await client.query('ROLLBACK');throw new Error('Account could not be created')}
  finally{client.release();await pool.end()}
}
main().catch(()=>{console.error('Account could not be created; check private input and database configuration');process.exitCode=1})
