import {sql} from 'drizzle-orm'
import {db} from '@/lib/db'
import {demoEnabled,demoSettings,demoApiKey} from '@/lib/demo-config'
import {verifyDemoSpace} from '@/lib/demo-access'
export const dynamic='force-dynamic'
export async function GET(){
  try{
    if(demoEnabled()){demoSettings();demoApiKey();await verifyDemoSpace()}
    else await db.execute(sql`SELECT 1`)
    return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}})
  }catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
