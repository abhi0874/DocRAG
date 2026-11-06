import {readFile} from 'node:fs/promises'
import pg from 'pg'
import {drizzle} from 'drizzle-orm/node-postgres'
import {migrate} from 'drizzle-orm/node-postgres/migrator'
const url=new URL(process.env.OLLAMA_DATABASE_URL)
if(url.hostname!=='db'||url.port!=='5432'||url.pathname!=='/docrag_container')throw new Error('Dedicated container database required')
const pool=new pg.Pool({connectionString:url.href})
try {
  const sql=await readFile('db/init.sql','utf8')
  await pool.query(sql.replace('vector(1536)','vector(768)'))
  await migrate(drizzle(pool),{migrationsFolder:'db/security-migrations'})
  console.log('Container schema ready')
} finally {await pool.end()}
