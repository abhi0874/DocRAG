CREATE TABLE "answer_feedback" (
	"answer_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_value" CHECK ("answer_feedback"."value" IN ('up','down'))
);
--> statement-breakpoint
CREATE TABLE "answer_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"document_id" integer NOT NULL,
	"document_hash" text NOT NULL,
	"answer_hash" text NOT NULL,
	"public_question_hash" text,
	"public_answer" text,
	"chunk_ids" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"model_digest" text,
	CONSTRAINT "answer_public_pair" CHECK (("answer_receipts"."public_question_hash" IS NULL AND "answer_receipts"."public_answer" IS NULL) OR ("answer_receipts"."public_question_hash" IS NOT NULL AND "answer_receipts"."public_answer" IS NOT NULL)),
	CONSTRAINT "answer_public_limit" CHECK ("answer_receipts"."public_answer" IS NULL OR length("answer_receipts"."public_answer")<=65536)
);
--> statement-breakpoint
CREATE TABLE "request_metrics" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"route" text NOT NULL,
	"method" text NOT NULL,
	"status" integer NOT NULL,
	"outcome" text NOT NULL,
	"latency_ms" double precision NOT NULL,
	"provider" text,
	"model" text,
	"cache" text,
	"error_category" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"total_tokens" bigint,
	"details" jsonb NOT NULL,
	CONSTRAINT "request_metrics_outcome" CHECK ("request_metrics"."outcome" IN ('completed','failed','cancelled')),
	CONSTRAINT "request_metrics_latency" CHECK ("request_metrics"."latency_ms" >= 0),
	CONSTRAINT "request_metrics_tokens" CHECK (("request_metrics"."input_tokens" IS NULL OR "request_metrics"."input_tokens">=0) AND ("request_metrics"."output_tokens" IS NULL OR "request_metrics"."output_tokens">=0) AND ("request_metrics"."total_tokens" IS NULL OR "request_metrics"."total_tokens">=0))
);
--> statement-breakpoint
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_answer_id_answer_receipts_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answer_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_receipts" ADD CONSTRAINT "answer_receipts_id_request_metrics_request_id_fk" FOREIGN KEY ("id") REFERENCES "public"."request_metrics"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_receipts" ADD CONSTRAINT "answer_receipts_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_receipts" ADD CONSTRAINT "answer_receipts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_metrics" ADD CONSTRAINT "request_metrics_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_metrics_owner_time_idx" ON "request_metrics" USING btree ("owner_id","created_at");