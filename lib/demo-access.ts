import {sql} from 'drizzle-orm'
import {db} from './db'
import {demoEnabled,demoSpace} from './demo-config'
import {allowedDemoQuestion} from './demo-policy'
import {HttpError} from './security/http'
import {consumeLimit} from './security/limits'
import type {DocumentSnapshot} from './evidence'
import type {RagUIMessage} from './types'
export function rejectDemoWrite() {
  if(demoEnabled()) throw new HttpError(403,'The public demo supports sample questions only. Use local Ollama for private documents.')
}
export async function verifyDemoSpace() {
  const result=await db.execute(sql`SELECT version,model,dimensions FROM demo_embedding_space WHERE singleton=true`)
  const row=result.rows[0]
  if(result.rows.length!==1 || row.version!==demoSpace.version || row.model!==demoSpace.model || row.dimensions!==demoSpace.dimensions)
    throw new HttpError(503,'Public demo indexing is not ready')
}
export async function admitDemoQuestion(snapshot:DocumentSnapshot,messages:RagUIMessage[],userId:string|null) {
  if(!demoEnabled()) return
  if(!allowedDemoQuestion(snapshot,messages)) throw new HttpError(403,'Choose a public sample question; private text is not sent to Gemini.')
  await verifyDemoSpace()
  await consumeLimit('demoUser',userId)
  await consumeLimit('demoMinute','global')
  await consumeLimit('demoDay','global')
}
