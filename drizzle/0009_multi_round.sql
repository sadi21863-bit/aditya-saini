ALTER TABLE "debate_turns" ADD COLUMN "round" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN "round_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN "verdict" text;
--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN "verdict_reasoning" text;
