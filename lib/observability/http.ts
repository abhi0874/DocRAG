import {elapsed,emit,errorCategory,newTrace,withTrace} from './context'
import {persistMetric} from './persist'

export function observed<C>(route:string,handler:(req:Request,context:C)=>Promise<Response>){
  return async (req:Request,context?:C):Promise<Response>=>{
    const trace=newTrace(route,req.method);emit('request.started',trace)
    let settled=false
    const abort=()=>{trace.cancelled=true}
    req.signal.addEventListener('abort',abort,{once:true})
    const finish=async(cancelled=false)=>{
      if(settled)return
      settled=true;trace.cancelled ||= cancelled||req.signal.aborted
      trace.outcome=trace.cancelled?'cancelled':trace.failed||trace.status>=400?'failed':'completed'
      trace.errorCategory=trace.cancelled?'cancelled':trace.failed?(trace.errorCategory??'model'):trace.status>=400?errorCategory(trace.status):null
      const duration=elapsed(trace.started)
      await persistMetric(trace,duration)
      // Cancellation while the bounded write was pending must not leave a success receipt.
      if((trace.cancelled||req.signal.aborted)&&trace.outcome!=='cancelled'){
        trace.outcome='cancelled';trace.errorCategory='cancelled';await persistMetric(trace,duration)
      }
      req.signal.removeEventListener('abort',abort);emit('request.finished',trace)
    }
    let response:Response
    try{response=await withTrace(trace,()=>handler(req,context as C))}
    catch{trace.failed=true;response=Response.json({error:'Request could not be completed'},{status:500})}
    trace.status=response.status
    const headers=new Headers(response.headers);headers.set('X-Request-ID',trace.id);headers.set('Cache-Control','no-store')
    if(!response.body){await finish();return new Response(null,{status:response.status,headers})}
    const reader=response.body.getReader()
    const body=new ReadableStream<Uint8Array>({
      async pull(controller){
        try{const part=await reader.read();if(part.done){await finish();controller.close()}else controller.enqueue(part.value)}
        catch(error){trace.failed=true;await finish();controller.error(error)}
      },
      async cancel(reason){trace.cancelled=true;try{await reader.cancel(reason)}finally{await finish(true)}},
    },{highWaterMark:0})
    return new Response(body,{status:response.status,headers})
  }
}
