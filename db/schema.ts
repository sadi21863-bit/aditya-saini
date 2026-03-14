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
  // Values: "dreamer" | "visionary" | "architect" | "oracle"
  tier: text("tier").default("dreamer").notNull(),

  // Lifetime accumulated XP.
  // +10 on launch, +5 per like received, +1 per follower gained
  // 0 on recall to draft, -10 on permanent delete
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

  // Public pitch written by the creator — always visible regardless of protection
  context: text("context"),

  content: text("content"),
  category: text("category"),
  status: text("status").default("draft").notNull(), // "draft" | "public"

  // Collaboration mode — "open" (anyone reads) | "closed" (access required)
  collaborationMode: text("collaboration_mode").default("open").notNull(),

  totalLikes: integer("total_likes").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  // Protection level — unlocked by tier
  // "open" | "guarded" | "shielded" | "vault"
  protectionLevel: text("protection_level").default("open").notNull(),

  // Populated ONLY on first draft → public transition. Never updated after.
  genesisHash: text("genesis_hash"),

  // Fuzzy content fingerprint for silent plagiarism detection.
  simHash: text("sim_hash"),

  // Users granted read access to protected ideas
  viewerIds: text("viewer_ids")
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
    uniqueFollow: uniqueIndex("unique_follow").on(
      table.followerId,
      table.followingId
    ),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SIMILARITY FLAGS (Justice Engine — silent, admin-only)
// ─────────────────────────────────────────────────────────────────────────────
export const similarityFlags = pgTable("similarity_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  idea1Id: uuid("idea1_id").notNull().references(() => ideas.id),
  idea2Id: uuid("idea2_id").notNull().references(() => ideas.id),
  similarityScore: integer("similarity_score").notNull(),
  detectedAt: timestamp("detected_at").defaultNow(),
  // "silent" = detected, no report yet
  // "under_review" = formal report filed
  // "resolved" = admin has ruled
  status: text("status").default("silent").notNull(),
  adminNotes: text("admin_notes"),
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. IDEA REVISIONS
// ─────────────────────────────────────────────────────────────────────────────
export const ideaRevisions = pgTable("idea_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  versionNumber: integer("version_number").notNull(),
  editedAt: timestamp("edited_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type SimilarityFlag = typeof similarityFlags.$inferSelect;
export type IdeaRevision = typeof ideaRevisions.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;
export type NewComment = typeof comments.$inferInsert;
export type NewFollow = typeof follows.$inferInsert;
