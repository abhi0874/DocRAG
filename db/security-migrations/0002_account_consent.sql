-- Existing accounts have no inferred acceptance.
ALTER TABLE "auth_user" ADD COLUMN "hosted_ai_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "hosted_consent_version" text;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "hosted_consent_country" text;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "hosted_consent_accepted_at" timestamp with time zone;
