import {createGoogle} from '@ai-sdk/google'
import {demoApiKey} from './demo-config'
/** Never retries and never redirects a credential to another endpoint. */
export function demoGoogle(transport:typeof fetch=fetch) {
  return createGoogle({apiKey:'blocked-until-request',fetch:async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
    if(url.origin!=='https://generativelanguage.googleapis.com' || url.searchParams.has('key')) throw new Error('Unexpected provider endpoint')
    const headers=new Headers(init?.headers)
    headers.set('x-goog-api-key',demoApiKey())
    return transport(input,{...init,headers,redirect:'error'})
  }})
}
