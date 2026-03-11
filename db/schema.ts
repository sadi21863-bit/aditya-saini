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
  id: text("id").primaryKey(),
  name: text("name"),
  handle: text("handle").unique(),
  email: text("email").notNull(),
  image: text("image"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),

  // Tier is derived from XP at runtime (lib/tier-engine.ts).
  // Values: "initiate" | "architect" | "master" | "genesis_legend"
  tier: text("tier").default("initiate").notNull(),

  // Lifetime accumulated XP.
  // +10 on launch, +5 per like received, -10 on recall, +25 when added as partner.
  xp: integer("xp").default(0).notNull(),

  // Score = total XP from likes only. Used for leaderboard ORDER BY score DESC.
  score: integer("score").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IDEAS
// ─────────────────────────────────────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),

  title: text("title").notNull(),
  hook: text("hook"),
  content: text("content"),
  category: text("category"),
  status: text("status").default("draft").notNull(), // "draft" | "public"

  totalLikes: integer("total_likes").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  // 0 = open, 1 = CSS select-none, 2 = JS block, 3 = full blur shield
  blurLevel: integer("blur_level").default(0).notNull(),

  // Populated ONLY on first draft → public transition.
  genesisHash: text("genesis_hash"),

  // Fuzzy content fingerprint for plagiarism detection.
  simHash: text("sim_hash"),

  // TIER 1: Viewers — unlocks blurred content (+5 XP)
  viewerIds: text("viewer_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  // TIER 2: Partners — unlocks content + Top-Shelf commenting (+25 XP)
  partnerIds: text("partner_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  // AI Metadata (Justice Engine)
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
// 4. FOLLOWS
// ─────────────────────────────────────────────────────────────────────────────
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: text("follower_id").notNull(),
    followingId: text("following_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueFollow: uniqueIndex("unique_follow").on(table.followerId, table.followingId),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),

  content: text("content").notNull(),

  // "public" = regular comment, "partner" = Top-Shelf (partners only)
  tier: text("tier").default("public").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Comment = typeof comments.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;
export type NewComment = typeof comments.$inferInsert;

export type AccessLevel = "viewer" | "partner";
export type NewFollow = typeof follows.$inferInsert;
