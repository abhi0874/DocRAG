import {demoEnabled} from '../demo-config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as application from './schema'
import * as observability from './observability-schema'
import * as security from './security-schema'
import { databaseConnection } from '../provider-config'

export const pool = new Pool({ connectionString: databaseConnection(), ...(demoEnabled()?{max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000}:{}) })
export const db = drizzle(pool, { schema: {...application,...security,...observability} })
