import {readFileSync} from 'node:fs'
import {startRagAnswer} from '../lib/rag-answer'
import {consumeAnswer} from './consume-answer'
import {localSettings} from '../lib/provider-config'
import {validateCitations} from '../lib/citations'
const originalFetch=globalThis.fetch
// Diagnostics are local-only even if an unexpected provider call is introduced.
globalThis.fetch=async(url,init)=>{
 const request=new Request(url,init)
 if(new URL(request.url).origin!==localSettings().baseUrl) throw new Error('Nonlocal diagnostic call rejected')
 return originalFetch(request)
}
async function main(){
 const input=JSON.parse(readFileSync(0,'utf8'))
 const messages=[{id:'diagnostic',role:'user' as const,parts:[{type:'text' as const,text:input.question}]}]
 const start=performance.now()
 const result=await consumeAnswer(await startRagAnswer(messages,input.context,input.version))
 if(result.finishReason!=='stop') throw new Error('Diagnostic answer incomplete')
 return {...result,latency_ms:performance.now()-start,citation_validation:validateCitations(result.text,input.context.length)}
}
main().then(r=>process.stdout.write(JSON.stringify(r))).catch(()=>{process.stderr.write('Grounding diagnostic failed\n');process.exitCode=1})
