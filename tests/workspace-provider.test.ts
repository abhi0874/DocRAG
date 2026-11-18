import {afterEach,expect,it,vi} from 'vitest'

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules()})
it('sends the actual grounded request and preserves provider truncation metadata',async()=>{
 vi.resetModules()
 for(const [key,value] of Object.entries({DOCRAG_DEPLOYMENT:'recruiter-demo',AI_PROVIDER:'gemini',DOCRAG_WORKSPACE_ENABLED:'true',DOCRAG_LOCAL_HTTP:'true',DOCRAG_WORKSPACE_TEST_DATABASE:'true',DOCRAG_POSTGRES_PORT:'55433',DEMO_DATABASE_URL:'postgresql://127.0.0.1:55433/docrag_security_test_012345abcdef',RERANKER_ENABLED:'false',RESPONSE_CACHE_ENABLED:'false',DOCRAG_GEMINI_BILLING_CONFIRMED:'no-linked-account',GEMINI_API_KEY:'synthetic-test-key-not-a-credential'}))vi.stubEnv(key,value)
 const body='data: '+JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'{"support":"full","evidence":[]}'}]},finishReason:'MAX_TOKENS',index:0}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:24,thoughtsTokenCount:1000,totalTokenCount:1124}})+'\n\n'
 const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(body,{headers:{'content-type':'text/event-stream'}}))
 vi.stubGlobal('fetch',transport)
 const {startRagAnswer}=await import('../lib/rag-answer')
 const result=await startRagAnswer([{id:'q',role:'user',parts:[{type:'text',text:'Why COMMIT?'}]}],[{id:1,content:'COMMIT makes changes permanent.',pageNumber:1,chunkIndex:0,vectorScore:1,keywordScore:1,rrfScore:1}],'grounded-v1')
 const parts=[];for await(const part of result.stream)parts.push(part)
 expect(transport).toHaveBeenCalledOnce()
 expect(String(transport.mock.calls[0][0])).toContain('gemini-3.5-flash-lite:streamGenerateContent')
 const request=JSON.parse(String(transport.mock.calls[0][1]?.body))
 expect(request.generationConfig.maxOutputTokens).toBe(1024)
 expect(request.generationConfig.stopSequences).toBeUndefined()
 expect(request.generationConfig.responseMimeType).toBeUndefined()
 expect(JSON.stringify(request.contents)).toContain('Why COMMIT?')
 expect(JSON.stringify(request.systemInstruction)).toContain('COMMIT makes changes permanent.')
 expect(JSON.stringify(request.systemInstruction)).toContain('After the JSON line')
 expect(parts.some(p=>p.type==='finish'&&p.finishReason==='length')).toBe(true)
 expect(await result.totalUsage).toMatchObject({outputTokens:1024,outputTokenDetails:{reasoningTokens:1000,textTokens:24}})
})
