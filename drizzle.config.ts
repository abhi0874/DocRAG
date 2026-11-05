import {defineConfig} from 'drizzle-kit'
// Additive security tables only. Existing application tables stay in db/init.sql.
export default defineConfig({dialect:'postgresql',schema:['./lib/db/security-schema.ts','./lib/db/observability-schema.ts'],out:'./db/security-migrations'})
