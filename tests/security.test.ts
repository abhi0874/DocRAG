import {describe,it,expect,vi,afterEach} from 'vitest'
vi.mock('@/lib/db',()=>({db:{}}))
import {appOrigin} from '@/lib/auth'
import {checkOrigin,chatInput,evaluationInput,jsonBody,limitedBody,pathId,safeError,HttpError} from '@/lib/security/http'
import {readPdf,parsePdf,MAX_PDF} from '@/lib/security/pdf'
import {acquireWork} from '@/lib/security/work'
import {searchStatements} from '@/lib/retrieval'
import {retrievalDefault} from '@/lib/retrieval-config'
import {PgDialect} from 'drizzle-orm/pg-core'

afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers()})
const body={documentId:3,messages:[{id:'1',role:'user',parts:[{type:'text',text:'What is BEGIN?'}]}]}
describe('request boundaries',()=>{
  it('requires HTTPS except explicit loopback development',()=>{
    vi.stubEnv('DOCRAG_APP_ORIGIN','http://app.example');vi.stubEnv('DOCRAG_LOCAL_HTTP','true')
    expect(()=>appOrigin()).toThrow('HTTPS required')
    vi.stubEnv('DOCRAG_APP_ORIGIN','https://app.example');expect(appOrigin().secure).toBe(true)
    vi.stubEnv('DOCRAG_APP_ORIGIN','http://localhost:8000');expect(appOrigin().secure).toBe(false)
    vi.stubEnv('DOCRAG_LOCAL_HTTP','false');expect(()=>appOrigin()).toThrow('HTTPS required')
  })
  it.each(['https://evil.example','null',''])('rejects unsafe origin %s',origin=>{
    vi.stubEnv('DOCRAG_APP_ORIGIN','https://app.example')
    expect(()=>checkOrigin(new Request('https://app.example/api/chat',{headers:{origin}}))).toThrow(HttpError)
  })
  it('rejects spoofed host and cross-site metadata',()=>{
    vi.stubEnv('DOCRAG_APP_ORIGIN','https://app.example')
    for(const extra of [{host:'evil.example'},{'sec-fetch-site':'cross-site'}] as Record<string,string>[])
      expect(()=>checkOrigin(new Request('https://app.example/api/chat',{headers:{origin:'https://app.example',...extra}}))).toThrow(HttpError)
  })
  it('accepts exact same origin',()=>{
    vi.stubEnv('DOCRAG_APP_ORIGIN','https://app.example')
    expect(()=>checkOrigin(new Request('https://app.example/api/chat',{headers:{origin:'https://app.example'}}))).not.toThrow()
  })
  it.each(['-1','0','3 OR 1=1','2147483648','1.0'])('rejects unsafe identifier %s',id=>expect(()=>pathId(id)).toThrow(HttpError))
  it('allows bounded conversation but not identities or model options',()=>{
    expect(chatInput.safeParse(body).success).toBe(true)
    for(const extra of [{userId:'owner'},{maxTokens:100000},{model:'other'}])expect(chatInput.safeParse({...body,...extra}).success).toBe(false)
    expect(chatInput.safeParse({...body,messages:Array(21).fill(body.messages[0])}).success).toBe(false)
    expect(evaluationInput.safeParse({documentId:3,question:'x'.repeat(8001)}).success).toBe(false)
  })
  it('rejects malformed JSON and non-JSON media',async()=>{
    await expect(jsonBody(new Request('https://app.example',{method:'POST',body:'{',headers:{'Content-Type':'application/json'}}),chatInput)).rejects.toMatchObject({status:400})
    await expect(jsonBody(new Request('https://app.example',{method:'POST',body:'{}'}),chatInput)).rejects.toMatchObject({status:415})
  })
  it('counts actual bytes even when content-length is absent',async()=>{
    await expect(limitedBody(new Request('https://app.example',{method:'POST',body:'x'.repeat(101)}),100)).rejects.toMatchObject({status:413})
  })
  it('cancels a stalled body after the deadline',async()=>{
    vi.useFakeTimers();const cancelled=vi.fn()
    const stream=new ReadableStream({cancel:cancelled})
    const req=new Request('https://app.example',{method:'POST',body:stream,duplex:'half'} as RequestInit)
    const result=expect(limitedBody(req,100)).rejects.toMatchObject({status:408})
    await vi.advanceTimersByTimeAsync(15000);await result;expect(cancelled).toHaveBeenCalledOnce()
  })
  it('never serializes internal exception messages',async()=>{
    const response=safeError(new Error('password=secret database details'))
    expect(response.status).toBe(500);expect(await response.text()).not.toMatch(/secret|password|database/)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
describe('upload and resource boundaries',()=>{
  function upload(bytes:Uint8Array,name='public.pdf',type='application/pdf'){
    const form=new FormData();form.append('file',new File([bytes as BlobPart],name,{type}))
    return new Request('https://app.example/api/documents',{method:'POST',body:form})
  }
  it.each(['..public.pdf','folder\\public.pdf'])('rejects unsafe filename %s',async name=>{
    await expect(readPdf(upload(new TextEncoder().encode('%PDF-1.4'),name))).rejects.toMatchObject({status:400})
  })
  it('checks MIME and magic independently',async()=>{
    await expect(readPdf(upload(new TextEncoder().encode('%PDF-1.4'),'public.pdf','text/plain'))).rejects.toMatchObject({status:415})
    await expect(readPdf(upload(new TextEncoder().encode('<script>')))).rejects.toMatchObject({status:415})
  })
  it('checks the multipart body cap before parsing',async()=>{
    await expect(readPdf(new Request('https://app.example',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=x','Content-Length':String(MAX_PDF+65537)},body:'x'}))).rejects.toMatchObject({status:413})
  })
  it('isolates corrupt PDF parsing in a terminating child',async()=>{
    await expect(parsePdf(Buffer.from('%PDF-1.4\ninvalid'))).rejects.toMatchObject({status:422})
  })
  it('releases concurrency exactly once after cancellation/failure',()=>{
    const a=acquireWork(),b=acquireWork()
    expect(acquireWork).toThrow(HttpError);a();a()
    const c=acquireWork();expect(acquireWork).toThrow(HttpError);b();c()
    const d=acquireWork();d()
  })
})
describe('SQL scope is correlated before candidate selection',()=>{
  it('binds each chunk to its access row before ORDER BY and LIMIT',()=>{
    const dialect=new PgDialect()
    const statements=searchStatements("x'; DROP TABLE chunks; --",42,Array(768).fill(0.1),retrievalDefault,'verified-user')
    for(const query of [statements.vectorSql,statements.keywordSql]){
      const compiled=dialect.sqlToQuery(query)
      expect(compiled.sql).toContain('access.document_id = chunks.document_id')
      expect(compiled.sql.indexOf('access.owner_id')).toBeLessThan(compiled.sql.indexOf('ORDER BY'))
      expect(compiled.params).toContain('verified-user');expect(compiled.sql).not.toContain('DROP TABLE')
    }
  })
})
