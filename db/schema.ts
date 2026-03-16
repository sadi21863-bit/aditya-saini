import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  uniqueIndex,
  jsonb,
  boolean,
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

  tier: text("tier").default("dreamer").notNull(),
  xp: integer("xp").default(0).notNull(),
  score: integer("score").default(0).notNull(),

  // ── v10 additions ──────────────────────────────────────────────
  // Up to 3 pinned idea UUIDs shown at top of profile
  pinnedIdeaIds: text("pinned_idea_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  // Auto-awarded badge keys e.g. ["first_idea", "100_sparks", "architect"]
  badges: text("badges")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IDEAS
// ─────────────────────────────────────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),

  title: text("title").notNull(),
  context: text("context"),
  content: text("content"),
  category: text("category"),
  status: text("status").default("draft").notNull(),

  collaborationMode: text("collaboration_mode").default("open").notNull(),

  totalLikes: integer("total_likes").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  protectionLevel: text("protection_level").default("open").notNull(),

  genesisHash: text("genesis_hash"),
  simHash: text("sim_hash"),

  viewerIds: text("viewer_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  aiMetadata: jsonb("ai_metadata"),

  // ── v10 additions ──────────────────────────────────────────────
  // Creator-set status flair
  // "research" | "concept" | "ready" | "cofound" | "built"
  flair: text("flair"),

  // v11 prep — remix origin
  remixedFromId: uuid("remixed_from_id"),

  // Admin-curated highlight
  editorsPick: boolean("editors_pick").default(false).notNull(),

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
// 6. SIMILARITY FLAGS
// ─────────────────────────────────────────────────────────────────────────────
export const similarityFlags = pgTable("similarity_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  idea1Id: uuid("idea1_id").notNull().references(() => ideas.id),
  idea2Id: uuid("idea2_id").notNull().references(() => ideas.id),
  similarityScore: integer("similarity_score").notNull(),
  detectedAt: timestamp("detected_at").defaultNow(),
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
// 8. BOOKMARKS  [v10]
// ─────────────────────────────────────────────────────────────────────────────
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueBookmark: uniqueIndex("unique_user_bookmark").on(
      table.userId,
      table.ideaId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. NOTIFICATIONS  [v10]
// ─────────────────────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),      // recipient
  type: text("type").notNull(),           // "spark" | "follow" | "comment" | "milestone" | "access_request"
  body: text("body").notNull(),           // human-readable message
  link: text("link"),                     // e.g. /idea/abc123
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
export type Bookmark = typeof bookmarks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;
export type NewComment = typeof comments.$inferInsert;
export type NewFollow = typeof follows.$inferInsert;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type NewNotification = typeof notifications.$inferInsert;
