CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"tier" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ideas" RENAME COLUMN "genesis_code" TO "genesis_hash";--> statement-breakpoint
ALTER TABLE "ideas" DROP CONSTRAINT "ideas_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "likes" DROP CONSTRAINT "likes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "total_likes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tier" SET DEFAULT 'initiate';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "blur_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "sim_hash" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "viewer_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "partner_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "ai_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_follow" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_handle_unique" UNIQUE("handle");