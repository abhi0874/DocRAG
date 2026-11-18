import {sql} from 'drizzle-orm'
import {pgTable, text, timestamp, boolean, integer, index, check, customType} from 'drizzle-orm/pg-core'
import {documents, evaluations} from './schema'

export const user = pgTable('auth_user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false), image: text('image'),
  hostedAiEnabled: boolean('hosted_ai_enabled').notNull().default(false),
  consentVersion: text('hosted_consent_version'), consentCountry: text('hosted_consent_country'),
  consentAcceptedAt: timestamp('hosted_consent_accepted_at', {withTimezone:true}),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', {withTimezone:true}).notNull().defaultNow(),
})
export const session = pgTable('auth_session', {
  id: text('id').primaryKey(), token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'),
}, t=>[index('auth_session_user_idx').on(t.userId)])
export const account = pgTable('auth_account', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}), password: text('password'),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'), scope: text('scope'),
  accessTokenExpiresAt: timestamp('access_token_expires_at',{withTimezone:true}),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at',{withTimezone:true}),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
}, t=>[index('auth_account_user_idx').on(t.userId)])
export const verification = pgTable('auth_verification', {
  id:text('id').primaryKey(), identifier:text('identifier').notNull(), value:text('value').notNull(),
  expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
})
// Missing access rows quarantine legacy records; no legacy owner is inferred.
export const documentAccess = pgTable('document_access', {
  documentId:integer('document_id').primaryKey().references(()=>documents.id,{onDelete:'cascade'}),
  ownerId:text('owner_id').references(()=>user.id),
  visibility:text('visibility').notNull(), provenance:text('provenance'),
},t=>[index('document_access_owner_idx').on(t.ownerId),check('document_access_classification',sql`
  (${t.visibility} = 'private' AND ${t.ownerId} IS NOT NULL AND ${t.provenance} IS NULL) OR
  (${t.visibility} = 'public' AND ${t.ownerId} IS NULL AND ${t.provenance} IS NOT NULL)` )])
export const evaluationAccess = pgTable('evaluation_access', {
  evaluationId:integer('evaluation_id').primaryKey().references(()=>evaluations.id,{onDelete:'cascade'}),
  ownerId:text('owner_id').notNull().references(()=>user.id),
})
const bytea=customType<{data:Buffer}>({dataType:()=> 'bytea'})
export const documentFiles=pgTable('document_files',{
  documentId:integer('document_id').primaryKey().references(()=>documents.id,{onDelete:'cascade'}),
  bytes:bytea('bytes').notNull(),
})
export const requestLimits=pgTable('request_limits',{
  key:text('key').primaryKey(), count:integer('count').notNull(),
  resetAt:timestamp('reset_at',{withTimezone:true}).notNull(),
})
