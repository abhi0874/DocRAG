import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {HttpError,limitedBody} from './http'
export const MAX_PDF=15*1024*1024
let parsing=false
export async function readPdf(req:Request) {
  if(!req.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new HttpError(415,'Expected a PDF upload')
  const body=await limitedBody(req,MAX_PDF+64*1024)
  let form:FormData
  try{form=await new Response(body,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData()}
  catch{throw new HttpError(400,'Invalid upload')}
  const file=form.get('file')
  if(!(file instanceof File) || [...form.keys()].length!==1) throw new HttpError(400,'No file provided')
  if(file.size>MAX_PDF) throw new HttpError(413,'File must be under 15MB')
  if(file.type!=='application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) throw new HttpError(415,'Only PDF files are supported')
  if(file.name.length>160 || /[\x00-\x1f\x7f\\/]/.test(file.name) || file.name.includes('..')) throw new HttpError(400,'Invalid filename')
  const bytes=Buffer.from(await file.arrayBuffer())
  if(!bytes.subarray(0,8).toString('ascii').match(/^%PDF-1\.[0-9]|^%PDF-2\.0/)) throw new HttpError(415,'Invalid PDF signature')
  return {bytes,filename:file.name}
}
export async function parsePdf(bytes:Buffer):Promise<{pages:string[];totalPages:number}> {
  if(parsing) throw new HttpError(429,'PDF parser is busy',5)
  parsing=true
  try{return await new Promise((resolveResult,reject)=>{
    const child=spawn(process.execPath,['--max-old-space-size=192',resolve('scripts/pdf-worker.mjs')],{
      env:{PATH:process.env.PATH,NODE_ENV:'production'},stdio:['pipe','pipe','ignore'],
    })
    let result='',settled=false
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);child.kill('SIGKILL')
      if(error) reject(error); else {try{resolveResult(JSON.parse(result))}catch{reject(new HttpError(422,'PDF could not be read'))}}}
    const timer=setTimeout(()=>finish(new HttpError(422,'PDF exceeds processing limits')),10000)
    child.stdout.on('data',data=>{result+=data.toString();if(Buffer.byteLength(result)>2*1024*1024)finish(new HttpError(422,'PDF exceeds text limit'))})
    child.on('error',()=>finish(new HttpError(422,'PDF could not be read')))
    child.on('close',code=>finish(code ? new HttpError(422,'PDF could not be read'):undefined))
    child.stdin.on('error',()=>{});child.stdin.end(bytes)
  })}finally{parsing=false}
}
