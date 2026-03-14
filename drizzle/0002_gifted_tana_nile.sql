CREATE TABLE "idea_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"content" text NOT NULL,
	"version_number" integer NOT NULL,
	"edited_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "similarity_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea1_id" uuid NOT NULL,
	"idea2_id" uuid NOT NULL,
	"similarity_score" integer NOT NULL,
	"detected_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'silent' NOT NULL,
	"admin_notes" text
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tier" SET DEFAULT 'dreamer';--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "context" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "collaboration_mode" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "protection_level" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity_flags" ADD CONSTRAINT "similarity_flags_idea1_id_ideas_id_fk" FOREIGN KEY ("idea1_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity_flags" ADD CONSTRAINT "similarity_flags_idea2_id_ideas_id_fk" FOREIGN KEY ("idea2_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "ideas" DROP COLUMN "hook";--> statement-breakpoint
ALTER TABLE "ideas" DROP COLUMN "blur_level";--> statement-breakpoint
ALTER TABLE "ideas" DROP COLUMN "partner_ids";