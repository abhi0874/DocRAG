/** Server configuration only. Never import this module from client components. */
export const demoSpace = {version:'gemini-001-1536-v1', model:'gemini-embedding-001', dimensions:1536} as const
export function demoEnabled() {
  const mode=process.env.DOCRAG_DEPLOYMENT
  if(mode && mode!=='local' && mode!=='recruiter-demo') throw new Error('Invalid deployment mode')
  return mode==='recruiter-demo'
}
export function demoSettings() {
  if(!demoEnabled() || process.env.AI_PROVIDER!=='gemini') throw new Error('Demo requires explicit Gemini provider')
  const model=process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite'
  // Reviewed models only: changing this allowlist requires quota/quality review.
  if(model!=='gemini-3.5-flash-lite') throw new Error('Unreviewed cloud model')
  if(process.env.RERANKER_ENABLED==='true' || process.env.RESPONSE_CACHE_ENABLED==='true') throw new Error('Demo cache and reranker must remain disabled')
  return {model,embedding:demoSpace,maxOutputTokens:1024,timeoutMs:45000,maxRetries:0} as const
}
export function demoDatabaseUrl() {
  demoSettings()
  const value=process.env.DEMO_DATABASE_URL
  if(!value) throw new Error('Dedicated demo database is required')
  const u=new URL(value)
  const native=u.hostname==='127.0.0.1' && u.port===(process.env.DOCRAG_POSTGRES_PORT || '55432')
  const neon=u.hostname.endsWith('.neon.tech') && u.searchParams.get('sslmode')==='verify-full'
  if(!['postgres:','postgresql:'].includes(u.protocol) || u.pathname!=='/docrag_demo_gemini_v1' || (!native&&!neon) || u.hash)
    throw new Error('Demo requires its isolated database with verified TLS remotely')
  for(const key of u.searchParams.keys()) if(key!=='sslmode') throw new Error('Unexpected database option')
  return value
}
export function demoApiKey() {
  demoSettings()
  if(process.env.DOCRAG_GEMINI_BILLING_CONFIRMED!=='no-linked-account') throw new Error('Cloud billing confirmation required')
  const key=process.env.GEMINI_API_KEY
  if(!key || key.trim()!==key || key.length<20) throw new Error('Server Gemini key is not configured')
  return key
}
export function normalizeDemoEmbedding(vector:number[]) {
  if(vector.length!==demoSpace.dimensions || vector.some(v=>!Number.isFinite(v))) throw new Error('Embedding space mismatch')
  const norm=Math.hypot(...vector)
  if(!norm || !Number.isFinite(norm)) throw new Error('Invalid embedding')
  return vector.map(v=>v/norm)
}
