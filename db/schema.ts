import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  uniqueIndex,
  jsonb,
  boolean,
  real,
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

  pinnedIdeaIds: text("pinned_idea_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

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

  flair: text("flair"),

  // v11 prep — remix origin
  remixedFromId: uuid("remixed_from_id"),

  // Admin-curated highlight
  editorsPick: boolean("editors_pick").default(false).notNull(),

  // ── v11 Truth Layer ────────────────────────────────────────────
  // Set true when a verified "Factually Critical" community note exists.
  // Blocks project level-up until creator acknowledges it.
  hasCriticalNote: boolean("has_critical_note").default(false).notNull(),

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
// 5. COMMENTS  (kept for backwards compat — upgraded in Phase 3)
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
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "spark" | "follow" | "comment" | "milestone" | "access_request" | "critical_note"
  body: text("body").notNull(),
  link: text("link"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. COMMUNITY NOTES  [v11 — Truth Layer]
// ─────────────────────────────────────────────────────────────────────────────
// Only Master+ tier users can submit notes.
// Justice Engine validates: voteCount >= threshold → status = "verified"
// Verified "factually_critical" notes set ideas.hasCriticalNote = true
// ─────────────────────────────────────────────────────────────────────────────
export const communityNotes = pgTable("community_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),

  note: text("note").notNull(),                        // max enforced in Zod
  supportingEvidence: jsonb("supporting_evidence"),    // { url, description }[]

  voteCount: integer("vote_count").default(0).notNull(),
  threshold: integer("threshold").default(5).notNull(), // votes needed to verify

  // "pending" → "verified" | "dismissed"
  status: text("status").default("pending").notNull(),

  // "informational" | "factually_critical"
  // factually_critical → triggers ideas.hasCriticalNote = true
  severity: text("severity").default("informational").notNull(),

  // true once the idea creator has acknowledged this note
  acknowledgedByCreator: boolean("acknowledged_by_creator")
    .default(false)
    .notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. PEER REVIEWS  [v11 — 3-Axis Rating System]
// ─────────────────────────────────────────────────────────────────────────────
// Replaces flat comments with weighted authority scoring.
// ratings: { feasibility: 1-5, originality: 1-5, impact: 1-5 }
// tierWeight: Dreamer=1 | Visionary=1.5 | Architect=2 | Oracle=5
// avgScore: pre-computed weighted average stored for fast leaderboard queries
// ─────────────────────────────────────────────────────────────────────────────
export const peerReviews = pgTable(
  "peer_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id),

    ratings: jsonb("ratings")
      .$type<{ feasibility: number; originality: number; impact: number }>()
      .notNull(),

    comment: text("comment"),                          // optional written review

    tierWeight: real("tier_weight").notNull(),         // snapshot of tier at review time
    avgScore: real("avg_score").notNull(),             // (feasibility+originality+impact)/3 * tierWeight

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    uniqueReview: uniqueIndex("unique_peer_review").on(
      table.ideaId,
      table.reviewerId
    ), // one review per user per idea
  })
);

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
export type CommunityNote = typeof communityNotes.$inferSelect;
export type PeerReview = typeof peerReviews.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;
export type NewComment = typeof comments.$inferInsert;
export type NewFollow = typeof follows.$inferInsert;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type NewNotification = typeof notifications.$inferInsert;
export type NewCommunityNote = typeof communityNotes.$inferInsert;
export type NewPeerReview = typeof peerReviews.$inferInsert;
