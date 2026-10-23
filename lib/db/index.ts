import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { databaseConnection } from '../provider-config'

export const pool = new Pool({ connectionString: databaseConnection() })
export const db = drizzle(pool, { schema })
