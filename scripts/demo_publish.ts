/** Publish the verified public Gemini index without making model calls.
 * Defaults to read-only preflight. --apply requires an empty, isolated Neon DB.
 * No database creation, cleanup, source writes, or authentication-data copying.
 */
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {Pool, type PoolClient} from 'pg'
import {drizzle} from 'drizzle-orm/node-postgres'
import {migrate} from 'drizzle-orm/node-postgres/migrator'
import {demoDatabaseUrl,demoSpace} from '../lib/demo-config'
import manifest from '../lib/public-cache-manifest.json'

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
type Chunk={id:number;chunkIndex:number;pageNumber:number;content:string;metadata:unknown}
type Document={id:number;title:string;filename:string;status:string}
type Snapshot={document:Document;chunks:Chunk[];vectors:string[]}
const corpusHash=hash(manifest.documents)

async function snapshot(client:PoolClient):Promise<Snapshot[]> {
  const space=await client.query('SELECT version,model,dimensions,corpus_hash FROM demo_embedding_space')
  if(space.rows.length!==1||space.rows[0].version!==demoSpace.version||space.rows[0].model!==demoSpace.model||space.rows[0].dimensions!==demoSpace.dimensions||space.rows[0].corpus_hash!==corpusHash)throw new Error('Embedding space mismatch')
  const snapshots:Snapshot[]=[]
  for(const entry of manifest.documents){
    const docs=await client.query<Document>("SELECT d.id,d.title,d.filename,d.status FROM documents d JOIN document_access a ON a.document_id=d.id WHERE d.id=$1 AND a.visibility='public' AND a.owner_id IS NULL",[entry.id])
    const chunks=await client.query<Chunk>('SELECT id,chunk_index AS "chunkIndex",page_number AS "pageNumber",content,metadata FROM chunks WHERE document_id=$1 ORDER BY id',[entry.id])
    const document=docs.rows[0]
    if(docs.rows.length!==1||hash({document,chunks:chunks.rows})!==entry.hash)throw new Error('Frozen public corpus mismatch')
    const embeddings=await client.query<{id:number;embedding:string}>('SELECT id,embedding::text FROM chunks WHERE document_id=$1 ORDER BY id',[entry.id])
    for(let i=0;i<embeddings.rows.length;i++){
      const row=embeddings.rows[i],vector:unknown=JSON.parse(row.embedding)
      if(row.id!==chunks.rows[i]?.id||!Array.isArray(vector)||vector.length!==1536||vector.some(v=>typeof v!=='number'||!Number.isFinite(v))||Math.abs(Math.hypot(...vector)-1)>0.00001)throw new Error('Invalid preserved vector')
    }
    if(embeddings.rows.length!==chunks.rows.length)throw new Error('Missing vectors')
    snapshots.push({document,chunks:chunks.rows,vectors:embeddings.rows.map(r=>r.embedding)})
  }
  if(snapshots.flatMap(s=>s.chunks).length!==162)throw new Error('Public chunk count mismatch')
  return snapshots
}

async function main(){
  const args=process.argv.slice(2)
  if(new Set(args).size!==args.length||args.some(a=>!['--check','--apply','--resume-empty-schema'].includes(a))||(args.includes('--check')&&args.includes('--apply')))throw new Error('Use --check or --apply, optionally --resume-empty-schema')
  const apply=args.includes('--apply'),resume=args.includes('--resume-empty-schema')
  const sourceUrl=new URL(process.env.DEMO_SOURCE_DATABASE_URL||'')
  if(sourceUrl.hostname!=='127.0.0.1'||sourceUrl.port!==(process.env.DOCRAG_POSTGRES_PORT||'55433')||sourceUrl.pathname!=='/docrag_demo_gemini_v1'||sourceUrl.search||sourceUrl.hash)throw new Error('Owned local Gemini source required')
  const targetUrl=new URL(demoDatabaseUrl())
  if(!targetUrl.hostname.endsWith('.neon.tech'))throw new Error('Neon destination required')
  const source=new Pool({connectionString:sourceUrl.href,max:1,connectionTimeoutMillis:10000})
  const target=new Pool({connectionString:targetUrl.href,max:1,connectionTimeoutMillis:20000})
  try{
    const src=await source.connect()
    let data:Snapshot[]
    try{
      await src.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')
      const identity=await src.query('SHOW data_directory')
      if(identity.rows[0].data_directory!==`${process.cwd()}/.local/postgres`)throw new Error('Source ownership mismatch')
      data=await snapshot(src)
      await src.query('COMMIT')
    }finally{src.release()}
    const identity=await target.query("SELECT current_database() AS name,pg_get_userbyid(datdba)=current_user AS owned,current_setting('server_version') AS version FROM pg_database WHERE datname=current_database()")
    if(identity.rows[0]?.name!=='docrag_demo_gemini_v1'||!identity.rows[0]?.owned)throw new Error('Destination identity mismatch')
    // Include every user schema: a partial migration must never be overwritten.
    const existing=await target.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")
    if(resume){
      // Only the reviewed migrations may remain after a rolled-back data copy.
      // No truncation, deletion, migration changes, or acceptance of partial data.
      const tables=['answer_feedback','answer_receipts','auth_account','auth_session','auth_user','auth_verification','chunks','document_access','document_files','documents','evaluation_access','evaluations','request_limits','request_metrics'].sort()
      const actual=await target.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
      if(existing.rows[0].n!==tables.length+1||JSON.stringify(actual.rows.map(r=>r.table_name))!==JSON.stringify(tables))throw new Error('Unexpected partial schema')
      for(const table of tables){
        const rows=await target.query(`SELECT count(*)::int AS n FROM "${table}"`)
        if(rows.rows[0].n!==0)throw new Error('Partial destination contains data')
      }
      const journal=JSON.parse(await readFile('db/security-migrations/meta/_journal.json','utf8')) as {entries:{tag:string;when:number}[]}
      const receipts=await target.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')
      if(receipts.rows.length!==journal.entries.length)throw new Error('Migration receipt count mismatch')
      for(let i=0;i<journal.entries.length;i++){
        const entry=journal.entries[i],sql=await readFile(`db/security-migrations/${entry.tag}.sql`,'utf8')
        if(receipts.rows[i].hash!==createHash('sha256').update(sql).digest('hex')||Number(receipts.rows[i].created_at)!==entry.when)throw new Error('Migration receipt mismatch')
      }
    }else if(existing.rows[0].n!==0)throw new Error('Destination is not empty; preserve and review it')
    console.log(JSON.stringify({phase:'preflight',status:'PASS',sourceOwned:true,targetDatabase:identity.rows[0].name,postgres:identity.rows[0].version,documents:data.length,chunks:162,space:demoSpace,corpusHash,vectorHash:hash(data.map(d=>d.vectors)),modelCalls:0}))
    if(!apply)return
    // Same reviewed migration mechanism as demo_bootstrap.ts. Never alter its SQL.
    if(!resume){
      await target.query(await readFile('db/init.sql','utf8'))
      await migrate(drizzle(target),{migrationsFolder:'db/security-migrations'})
    }
    const dst=await target.connect()
    try{
      await dst.query('BEGIN')
      await dst.query(await readFile('db/demo-space.sql','utf8'))
      for(const {document,chunks,vectors} of data){
        await dst.query('INSERT INTO documents(id,title,filename,status,chunk_count,page_count) VALUES($1,$2,$3,$4,$5,$6)',[document.id,document.title,document.filename,document.status,chunks.length,Math.max(...chunks.map(c=>c.pageNumber))])
        await dst.query("INSERT INTO document_access(document_id,visibility,provenance) VALUES($1,'public',$2)",[document.id,'frozen-public-demo-v1'])
        for(let i=0;i<chunks.length;i++){
          const c=chunks[i]
          await dst.query('INSERT INTO chunks(id,document_id,chunk_index,page_number,content,metadata,embedding) VALUES($1,$2,$3,$4,$5,$6,$7)',[c.id,document.id,c.chunkIndex,c.pageNumber,c.content,JSON.stringify(c.metadata),vectors[i]])
        }
      }
      await dst.query('INSERT INTO demo_embedding_space(version,model,dimensions,corpus_hash) VALUES($1,$2,$3,$4)',[demoSpace.version,demoSpace.model,demoSpace.dimensions,corpusHash])
      await dst.query("SELECT setval(pg_get_serial_sequence('documents','id'),(SELECT max(id) FROM documents))")
      await dst.query("SELECT setval(pg_get_serial_sequence('chunks','id'),(SELECT max(id) FROM chunks))")
      const copied=await snapshot(dst)
      if(hash(copied)!==hash(data))throw new Error('Destination readback mismatch')
      const users=await dst.query('SELECT count(*)::int AS n FROM auth_user')
      if(users.rows[0].n!==0)throw new Error('Unexpected authentication records')
      await dst.query('COMMIT')
      console.log(JSON.stringify({phase:'copy',status:'PASS',documents:2,chunks:162,exactVectorReadback:true,authenticationRowsCopied:0,modelCalls:0}))
    }catch(error){await dst.query('ROLLBACK');throw error}finally{dst.release()}
  }finally{await source.end();await target.end()}
}
main().catch(error=>{
  // Never print driver errors, SQL parameters, connection strings or source data.
  console.error(JSON.stringify({status:'FAIL',code:typeof error?.code==='string'?error.code:'PUBLICATION_GUARD',message:'Publication stopped. Preserve partial destination; no automatic retry or cleanup.'}))
  process.exitCode=1
})
