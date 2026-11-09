import {createHash} from 'node:crypto'
import manifest from './public-cache-manifest.json'
import type {DocumentSnapshot} from './evidence'
import type {RagUIMessage} from './types'
/** Only fixed public questions: free-text/private conversation never leaves the Mac. */
export function allowedDemoQuestion(snapshot:DocumentSnapshot,messages:RagUIMessage[]) {
  if(!snapshot.isPublic || !manifest.documents.some(d=>d.id===snapshot.document.id&&d.hash===snapshot.hash)) return false
  if(messages.length!==1 || messages[0].role!=='user' || messages[0].parts.length!==1 || messages[0].parts[0].type!=='text') return false
  const text=messages[0].parts[0].text.trim()
  const hash=createHash('sha256').update(JSON.stringify(text)).digest('hex')
  return manifest.questions.some(q=>q.documentId===snapshot.document.id&&q.hash===hash)
}
