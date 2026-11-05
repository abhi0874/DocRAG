import {sql} from 'drizzle-orm'
import {pgTable,uuid,text,integer,doublePrecision,bigint,timestamp,jsonb,index,check} from 'drizzle-orm/pg-core'
import {user} from './security-schema'
import {documents} from './schema'
export const requestMetrics=pgTable('request_metrics',{
  requestId:uuid('request_id').primaryKey(),ownerId:text('owner_id').references(()=>user.id,{onDelete:'cascade'}),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(),route:text('route').notNull(),method:text('method').notNull(),
  status:integer('status').notNull(),outcome:text('outcome').notNull(),latencyMs:doublePrecision('latency_ms').notNull(),
  provider:text('provider'),model:text('model'),cache:text('cache'),errorCategory:text('error_category'),
  inputTokens:bigint('input_tokens',{mode:'number'}),outputTokens:bigint('output_tokens',{mode:'number'}),totalTokens:bigint('total_tokens',{mode:'number'}),
  details:jsonb('details').notNull(),
},t=>[index('request_metrics_owner_time_idx').on(t.ownerId,t.createdAt),
  check('request_metrics_outcome',sql`${t.outcome} IN ('completed','failed','cancelled')`),
  check('request_metrics_latency',sql`${t.latencyMs} >= 0`),
  check('request_metrics_tokens',sql`(${t.inputTokens} IS NULL OR ${t.inputTokens}>=0) AND (${t.outputTokens} IS NULL OR ${t.outputTokens}>=0) AND (${t.totalTokens} IS NULL OR ${t.totalTokens}>=0)`)])
export const answerReceipts=pgTable('answer_receipts',{
  id:uuid('id').primaryKey().references(()=>requestMetrics.requestId,{onDelete:'cascade'}),
  ownerId:text('owner_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  documentId:integer('document_id').notNull().references(()=>documents.id,{onDelete:'cascade'}),
  documentHash:text('document_hash').notNull(),answerHash:text('answer_hash').notNull(),
  publicQuestionHash:text('public_question_hash'),publicAnswer:text('public_answer'),chunkIds:jsonb('chunk_ids').$type<number[]>().notNull(),
  promptVersion:text('prompt_version').notNull(),model:text('model').notNull(),modelDigest:text('model_digest'),
},t=>[check('answer_public_pair',sql`(${t.publicQuestionHash} IS NULL AND ${t.publicAnswer} IS NULL) OR (${t.publicQuestionHash} IS NOT NULL AND ${t.publicAnswer} IS NOT NULL)`),
  check('answer_public_limit',sql`${t.publicAnswer} IS NULL OR length(${t.publicAnswer})<=65536`)])
export const answerFeedback=pgTable('answer_feedback',{
  answerId:uuid('answer_id').primaryKey().references(()=>answerReceipts.id,{onDelete:'cascade'}),
  ownerId:text('owner_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  value:text('value').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('feedback_value',sql`${t.value} IN ('up','down')`)])
