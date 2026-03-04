import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// 1. USERS
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),             // Clerk Auth ID
  name: text("name"),
  handle: text("handle").unique(),             // Unique @username
  email: text("email").notNull(),
  image: text("image"),
  bio: text("bio"),                          // Profile bio/tagline
  avatarUrl: text("avatar_url"),                   // Custom avatar URL

  // Tier is derived from XP at runtime (lib/tier-engine.ts).
  // Stored here as a cache so UI queries are cheap.
  // Values: "initiate" | "architect" | "master" | "genesis_legend"
  tier: text("tier").default("initiate").notNull(),

  // Lifetime accumulated XP. Used for tier calculation.
  // +10 on launch, +5 per like received, -10 on recall, +25 when added as partner.
  xp: integer("xp").default(0).notNull(),

  // Score is the user's total XP received from likes specifically.
  // Used for leaderboard ordering: ORDER BY score DESC.
  // Incremented +5 whenever someone likes one of their ideas.
  score: integer("score").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IDEAS
// ─────────────────────────────────────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),                        // Genesis Creator's Clerk ID

  title: text("title").notNull(),
  hook: text("hook"),                          // One-sentence summary
  content: text("content"),                       // Full body text
  category: text("category"),
  status: text("status").default("draft").notNull(), // "draft" | "public"

  // ── Engagement ──────────────────────────────────────────────────────────
  totalLikes: integer("total_likes").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  // ── IP Protection ───────────────────────────────────────────────────────
  // 0 = open, 1 = CSS select-none, 2 = JS right-click/copy block, 3 = full blur shield
  blurLevel: integer("blur_level").default(0).notNull(),

  // ── Genesis Security ────────────────────────────────────────────────────
  // Populated ONLY when idea first transitions draft → public.
  // Hash seed: SHA-256(title + content + userId + timestamp)
  // Null means the idea has never been launched.
  genesisHash: text("genesis_hash"),

  // ── Phase 4: Similarity Hash ────────────────────────────────────────────
  // Fuzzy content fingerprint for plagiarism detection.
  // Generated from normalized(title + content).
  // If a match is found, launch is BLOCKED.
  simHash: text("sim_hash"),

  // ── Phase 5: Access & Partner System ────────────────────────────────────
  // TIER 1: Viewers - Unlocks hidden/blurred content (+5 XP)
  viewerIds: text("viewer_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  // TIER 2: Partners - Unlocks content + Top-Shelf commenting authority (+25 XP)
  partnerIds: text("partner_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  // ── Phase 3: AI Metadata (Justice Engine) ───────────────────────────────
  aiMetadata: jsonb("ai_metadata"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LIKES
// ─────────────────────────────────────────────────────────────────────────────
export const likes = pgTable(
  "likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id"),
    ideaId: uuid("idea_id").references(() => ideas.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueLike: uniqueIndex("unique_user_like").on(table.userId, table.ideaId),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type Like = typeof likes.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;

export type AccessLevel = "viewer" | "partner";
