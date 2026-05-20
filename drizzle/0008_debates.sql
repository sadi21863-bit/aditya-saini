CREATE TABLE "debates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"original_input" text NOT NULL,
	"title" text NOT NULL,
	"debate_type" text NOT NULL,
	"judge_verdict" text DEFAULT 'pending' NOT NULL,
	"judge_reasoning" text,
	"judge_answer" text,
	"debate_mode" text,
	"archivist_summary" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"share_token" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "debates_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "debate_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debate_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debate_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"slot_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debate_id" uuid NOT NULL,
	"agent_id" text,
	"author_type" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debates" ADD CONSTRAINT "debates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debate_questions" ADD CONSTRAINT "debate_questions_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debate_turns" ADD CONSTRAINT "debate_turns_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debate_turns" ADD CONSTRAINT "debate_turns_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_debates_user" ON "debates" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "idx_debates_share" ON "debates" USING btree ("share_token") WHERE "debates"."share_token" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_debate_participants_debate" ON "debate_participants" USING btree ("debate_id");
--> statement-breakpoint
CREATE INDEX "idx_debate_turns_debate" ON "debate_turns" USING btree ("debate_id","created_at");
