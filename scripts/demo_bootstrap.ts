/** Explicit public-only bootstrap. No database creation; refuses nonempty destinations. */
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {Pool} from 'pg'
import {drizzle} from 'drizzle-orm/node-postgres'
import {migrate} from 'drizzle-orm/node-postgres/migrator'
import {embedMany} from 'ai'
import manifest from '../lib/public-cache-manifest.json'
import {demoApiKey,demoDatabaseUrl,demoSpace,normalizeDemoEmbedding} from '../lib/demo-config'
import {demoGoogle} from '../lib/demo-provider'
async function main(){
  // No DDL or API calls without account confirmation, exact isolated target and public source.
  demoApiKey()
  const sourceUrl=new URL(process.env.DEMO_SOURCE_DATABASE_URL || '')
  if(sourceUrl.hostname!=='127.0.0.1'||sourceUrl.port!==(process.env.DOCRAG_POSTGRES_PORT||'55432')||sourceUrl.pathname!=='/docrag_chunking_heading_1400_280'||sourceUrl.search||sourceUrl.hash)throw new Error('Verified local public corpus source required')
  const source=new Pool({connectionString:sourceUrl.href,max:1}),target=new Pool({connectionString:demoDatabaseUrl(),max:1})
  try{
    const identity=await source.query('SHOW data_directory')
    if(identity.rows[0].data_directory!==`${process.cwd()}/.local/postgres`)throw new Error('Source cluster ownership mismatch')
    const count=await target.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")
    if(count.rows[0].n!==0)throw new Error('Destination must be empty; preserve and review partial runs')
    const publicDocs=[]
    await source.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')
    for(const entry of manifest.documents){
      const docs=await source.query("SELECT d.id,d.title,d.filename,d.status FROM documents d JOIN document_access a ON a.document_id=d.id WHERE d.id=$1 AND a.visibility='public' AND a.owner_id IS NULL",[entry.id])
      const chunks=await source.query('SELECT id,chunk_index AS "chunkIndex",page_number AS "pageNumber",content,metadata FROM chunks WHERE document_id=$1 ORDER BY id',[entry.id])
      const document=docs.rows[0]
      const hash=createHash('sha256').update(JSON.stringify({document,chunks:chunks.rows})).digest('hex')
      if(docs.rows.length!==1||hash!==entry.hash)throw new Error('Public corpus hash mismatch')
      publicDocs.push({document,chunks:chunks.rows})
    }
    await source.query('COMMIT')
    // Synchronous standard embeddings, not asynchronous paid Batch jobs.
    // At most 8,000 UTF-8 bytes per request; 32 seconds between requests.
    const vectors=new Map<number,number[]>()
    const chunks=publicDocs.flatMap(item=>item.chunks)
    if(chunks.some(c=>Buffer.byteLength(c.content)>2000))throw new Error('Public chunk exceeds indexing budget')
    for(let i=0;i<chunks.length;){
      const batch=[];let bytes=0
      while(i<chunks.length && bytes+Buffer.byteLength(chunks[i].content)<=8000){bytes+=Buffer.byteLength(chunks[i].content);batch.push(chunks[i++])}
      const result=await embedMany({model:demoGoogle().embedding(demoSpace.model),values:batch.map(c=>c.content),maxRetries:0,abortSignal:AbortSignal.timeout(45000),providerOptions:{google:{taskType:'RETRIEVAL_DOCUMENT',outputDimensionality:demoSpace.dimensions}}})
      if(result.embeddings.length!==batch.length)throw new Error('Missing vectors')
      batch.forEach((c,j)=>vectors.set(c.id,normalizeDemoEmbedding(result.embeddings[j])))
      console.log(JSON.stringify({embedded:i,total:chunks.length}))
      if(i<chunks.length)await new Promise(resolve=>setTimeout(resolve,32000))
    }
    await target.query(await readFile('db/init.sql','utf8'))
    await migrate(drizzle(target),{migrationsFolder:'db/security-migrations'})
    await target.query(await readFile('db/demo-space.sql','utf8'))
    const client=await target.connect()
    try{
      await client.query('BEGIN')
      for(const {document,chunks} of publicDocs){
        await client.query('INSERT INTO documents(id,title,filename,status,chunk_count,page_count) VALUES($1,$2,$3,$4,$5,$6)',[document.id,document.title,document.filename,document.status,chunks.length,Math.max(...chunks.map(c=>c.pageNumber))])
        await client.query("INSERT INTO document_access(document_id,visibility,provenance) VALUES($1,'public',$2)",[document.id,'frozen-public-demo-v1'])
        for(const c of chunks)await client.query('INSERT INTO chunks(id,document_id,chunk_index,page_number,content,metadata,embedding) VALUES($1,$2,$3,$4,$5,$6,$7)',[c.id,document.id,c.chunkIndex,c.pageNumber,c.content,JSON.stringify(c.metadata),JSON.stringify(vectors.get(c.id))])
      }
      await client.query('INSERT INTO demo_embedding_space(version,model,dimensions,corpus_hash) VALUES($1,$2,$3,$4)',[demoSpace.version,demoSpace.model,demoSpace.dimensions,createHash('sha256').update(JSON.stringify(manifest.documents)).digest('hex')])
      await client.query("SELECT setval(pg_get_serial_sequence('documents','id'),(SELECT max(id) FROM documents))")
      await client.query("SELECT setval(pg_get_serial_sequence('chunks','id'),(SELECT max(id) FROM chunks))")
      await client.query('COMMIT')
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
    console.log('Public demo corpus indexed in its separate embedding space')
  }finally{await source.end();await target.end()}
}
main().catch(()=>{console.error('Demo bootstrap failed; details withheld. Preserve partial destination; no automatic retry or cleanup.');process.exitCode=1})
