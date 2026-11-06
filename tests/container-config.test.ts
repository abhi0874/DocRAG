import {afterEach,describe,expect,it,vi} from 'vitest'
import {databaseConnection,ollamaBaseUrl} from '../lib/provider-config'
afterEach(()=>vi.unstubAllEnvs())
describe('explicit container boundary',()=>{
  it('requires opt-in for host Ollama',()=>{
    vi.stubEnv('OLLAMA_BASE_URL','http://host.docker.internal:11434')
    expect(()=>ollamaBaseUrl()).toThrow()
    vi.stubEnv('DOCRAG_RUNTIME','container')
    expect(ollamaBaseUrl()).toBe('http://host.docker.internal:11434')
    vi.stubEnv('OLLAMA_BASE_URL','http://example.com:11434')
    expect(()=>ollamaBaseUrl()).toThrow()
  })
  it('restricts container database identity',()=>{
    vi.stubEnv('AI_PROVIDER','ollama');vi.stubEnv('DOCRAG_RUNTIME','container')
    vi.stubEnv('OLLAMA_DATABASE_URL','postgresql://docrag:test@db:5432/docrag_container')
    expect(databaseConnection()).toContain('/docrag_container')
    for(const url of ['postgresql://db:5432/another_project','postgresql://remote:5432/docrag_container','postgresql://db:5432/docrag_container?sslmode=disable']){
      vi.stubEnv('OLLAMA_DATABASE_URL',url);expect(()=>databaseConnection()).toThrow()
    }
  })
})
