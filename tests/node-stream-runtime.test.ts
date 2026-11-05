import {expect,it} from 'vitest'
import {spawnSync} from 'node:child_process'
it('handles the actual Node Web Streams rejection without process-level suppression',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
 const source=new ReadableStream({start(c){c.enqueue('a');c.enqueue('b');c.close()}})
 try{
  await source.pipeThrough(new TransformStream({async transform(chunk,c){c.enqueue(chunk)}}))
   .pipeThrough(new TransformStream()).pipeThrough(new TransformStream({transform(){throw new Error('controlled')}}))
   .pipeTo(new WritableStream())
 }catch(error){if(error.message!=='controlled')throw error;console.log('caught expected failure')}
 `],{encoding:'utf8'})
 expect(result.stdout).toContain('caught expected failure');expect(result.stderr).toBe('');expect(result.status).toBe(0)
})
