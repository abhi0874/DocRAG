// Existing route tests continue through real request parsing/stream/cache code.
// Only verified-session lookup and persistent quotas are substituted here;
// the separate real HTTP/database suite exercises both with actual accounts.
import {beforeEach,vi} from 'vitest'
vi.mock('@/lib/auth',()=>({appOrigin:()=>({origin:'http://localhost',host:'localhost',secure:false}),
  getAuth:()=>({api:{getSession:async()=>({user:{id:'unit-user'}})}})}))
vi.mock('@/lib/security/limits',()=>({consumeLimit:vi.fn(async()=>{})}))
beforeEach(()=>{vi.clearAllMocks()})

// Persistence is verified by the real HTTP suite; keep existing route units isolated.
vi.mock('@/lib/observability/persist',()=>({persistMetric:vi.fn(async()=>true)}))
