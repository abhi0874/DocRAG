import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as application from './schema'
import * as security from './security-schema'
import { databaseConnection } from '../provider-config'

export const pool = new Pool({ connectionString: databaseConnection() })
export const db = drizzle(pool, { schema: {...application,...security} })
