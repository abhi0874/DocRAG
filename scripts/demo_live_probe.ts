/** Two bounded standard API calls, public text only. Never prints provider errors or keys. */
import {open} from 'node:fs/promises'
import {streamText,embed} from 'ai'
import {demoGoogle} from '../lib/demo-provider'
import {demoSettings,normalizeDemoEmbedding} from '../lib/demo-config'
async function main(){
// Reserve the receipt before any API call; rerunning a completed probe is refused.
const receipt=await open('docs/step11/live-provider-probe-a.json','wx',0o600)
const report:Record<string,unknown>={provenance:'fresh live Gemini standard API',startedAt:new Date().toISOString()}
try{
 const config=demoSettings(),google=demoGoogle()
 const start=performance.now()
 const result=streamText({model:google(config.model),prompt:'Public sample: PostgreSQL is a relational database. Reply with one short sentence describing it.',maxOutputTokens:128,maxRetries:0,abortSignal:AbortSignal.timeout(45000)})
 let text='',errors=0,first:number|null=null
 for await(const p of result.stream){if(p.type==='text-delta'){first??=performance.now()-start;text+=p.text}if(p.type==='error')errors++}
 report.generation={model:config.model,nonempty:!!text.trim(),errors,latencyMs:performance.now()-start,firstTokenMs:first,usage:await result.totalUsage}
 if(errors||!text.trim())throw new Error('Generation failed')
 const eStart=performance.now()
 const e=await embed({model:google.embedding(config.embedding.model),value:'PostgreSQL is a relational database.',maxRetries:0,abortSignal:AbortSignal.timeout(45000),providerOptions:{google:{taskType:'RETRIEVAL_QUERY',outputDimensionality:1536}}})
 const vector=normalizeDemoEmbedding(e.embedding)
 report.embedding={model:config.embedding.model,dimensions:vector.length,norm:Math.hypot(...vector),latencyMs:performance.now()-eStart,usage:e.usage}
 report.status='PASS'
}catch{report.status='FAIL';report.error='Provider probe failed; no automatic retries or fallback';process.exitCode=1}
try{await receipt.writeFile(JSON.stringify(report,null,2)+'\n')}finally{await receipt.close()}
console.log(JSON.stringify(report))

}
main().catch(()=>{console.error("Probe runner failed; details withheld");process.exitCode=1})
