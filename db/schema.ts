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
// tier: explorer | builder | architect | pioneer  (v13 — changed from v12)
// xp: unified pool; privateXp + publicXp are sub-totals for leaderboard badge
// allowRemix: if false, others cannot remix this user's public ideas
// score: REMOVED (was never read in v12, dropped in v13 migration)
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  handle: text("handle").unique(),
  email: text("email").notNull(),
  image: text("image"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),

  // v13: unified xp + domain sub-totals
  xp: integer("xp").default(0).notNull(),
  privateXp: integer("private_xp").default(0).notNull(),
  publicXp: integer("public_xp").default(0).notNull(),

  // v13: explorer | builder | architect | pioneer
  tier: text("tier").default("explorer").notNull(),

  // v13: opt-out of having your public ideas remixed
  allowRemix: boolean("allow_remix").default(true).notNull(),

  pinnedIdeaIds: text("pinned_idea_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  badges: text("badges")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IDEAS — unified table for both private and public domain
// domain: 'private' | 'public'
//   private = Genesis Vault (IP protected, genesis hash, AI analysis)
//   public  = Idea Commons (open collaboration, remixable)
// remixedFromId: self-FK, max depth 1 enforced at API level
// genesisHash: moved to genesisHashes table in v13; kept here as nullable
//   legacy field for v12 ideas that already have a hash stored inline
// aiSummary / aiStatus / aiQueuedAt: only meaningful for private ideas
// ─────────────────────────────────────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

  // v13: 'private' | 'public'  (old v12 value was always 'vault')
  domain: text("domain").default("private").notNull(),

  title: text("title").notNull(),
  context: text("context"),
  content: text("content"),
  category: text("category"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").default("draft").notNull(), // draft | published

  ipProtected: boolean("ip_protected").default(false).notNull(),

  // Legacy genesis hash — kept for v12 rows; new rows use genesisHashes table
  genesisHash: text("genesis_hash"),

  totalLikes: integer("total_likes").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  aiMetadata: jsonb("ai_metadata"),
  editorsPick: boolean("editors_pick").default(false).notNull(),

  // AI analysis fields (private ideas only, opt-in, owner-triggered)
  aiSummary: text("ai_summary"),
  aiStatus: text("ai_status"),          // null | queued | processing | done | failed
  aiQueuedAt: timestamp("ai_queued_at"),

  // v13: remix chain — public ideas only, max depth 1
  remixedFromId: uuid("remixed_from_id").references((): any => ideas.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. IDEA COMMENTS — shared across both domains (private + public ideas)
// parentId has FK constraint added in v13
// ─────────────────────────────────────────────────────────────────────────────
export const ideaComments = pgTable("idea_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  // v13: FK constraint added (was missing in v12)
  parentId: uuid("parent_id").references((): any => ideaComments.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. IDEA LIKES — shared across both domains
// ─────────────────────────────────────────────────────────────────────────────
export const ideaLikes = pgTable(
  "idea_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueIdeaLike: uniqueIndex("unique_user_idea_like").on(
      table.userId,
      table.ideaId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. REVIEWS — peer reviews on ideas (Tier 1+ only, one per user per idea)
// verdict: valid | needs_work | invalid
// rating: 1–5 integer
// tags: well_researched | vague | duplicate | innovative
// immutable after 24h (enforced at API level via createdAt, no extra column)
// ─────────────────────────────────────────────────────────────────────────────
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optional: link this review to a comment
    commentId: uuid("comment_id").references(() => ideaComments.id, {
      onDelete: "set null",
    }),
    verdict: text("verdict").notNull(), // valid | needs_work | invalid
    rating: integer("rating").notNull(), // 1–5
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    uniqueReview: uniqueIndex("unique_user_idea_review").on(
      table.ideaId,
      table.userId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. GENESIS HASHES — cryptographic timestamps for private ideas
// One row per idea (UNIQUE). otsBlobUrl populated async after OTS call.
// confirmed = true once Bitcoin anchoring is verified.
// ─────────────────────────────────────────────────────────────────────────────
export const genesisHashes = pgTable("genesis_hashes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .unique()
    .references(() => ideas.id, { onDelete: "cascade" }),
  hash: text("hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  otsBlobUrl: text("ots_blob_url"),
  confirmed: boolean("confirmed").default(false).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. XP EVENTS — idempotency log for all XP awards
// Prevents double-awarding for the same trigger (e.g. same remix, same launch)
// ideaId is nullable (some events are not idea-specific)
// ─────────────────────────────────────────────────────────────────────────────
export const xpEvents = pgTable("xp_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // maps to XP_EVENTS keys
  ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
  xpAwarded: integer("xp_awarded").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. CHALLENGES — admin-set challenges (public domain only)
// winnerId FK fixed in v13 to reference ideas (not communityIdeas)
// ─────────────────────────────────────────────────────────────────────────────
export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  topic: text("topic").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").default("active").notNull(), // active | closed | judged
  // v13: FK constraint added (was missing in v12)
  winnerId: uuid("winner_id").references(() => ideas.id, { onDelete: "set null" }),
  bonusXp: integer("bonus_xp").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CHALLENGE SUBMISSIONS
// ─────────────────────────────────────────────────────────────────────────────
export const challengeSubmissions = pgTable(
  "challenge_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // v13: references unified ideas table (was communityIdeas in v12)
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueSubmission: uniqueIndex("unique_challenge_submission").on(
      table.challengeId,
      table.userId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. REPORTS — domain-aware moderation
// targetId is polymorphic: references ideas.id for both domains
// domain discriminates which table the target belongs to
// reportType: v13 enum — plagiarism (private only) | vulgar_inappropriate | political | opinion_not_idea
// NOTE: plagiarism reports on public ideas are rejected at API level (400)
// ─────────────────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(), // 'private' | 'public'
  targetId: uuid("target_id").notNull(), // references ideas.id (polymorphic by design)
  reportType: text("report_type").notNull(), // plagiarism | vulgar_inappropriate | political | opinion_not_idea
  details: text("details"),
  status: text("status").default("pending").notNull(), // pending | reviewed | dismissed
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. NOTIFICATIONS — shared across both domains
// ─────────────────────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  domain: text("domain"),   // 'private' | 'public' | null (system)
  read: boolean("read").default(false).notNull(),
  actionable: boolean("actionable").default(false).notNull(),
  actionPayload: jsonb("action_payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. FOLLOWS
// ─────────────────────────────────────────────────────────────────────────────
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
// 13. AI QUEUE — Groq rate-limit queue (private ideas only)
// ─────────────────────────────────────────────────────────────────────────────
export const aiQueue = pgTable("ai_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  estimatedAt: timestamp("estimated_at"),
  status: text("status").default("waiting").notNull(), // waiting | processing | done
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type IdeaComment = typeof ideaComments.$inferSelect;
export type IdeaLike = typeof ideaLikes.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type GenesisHash = typeof genesisHashes.$inferSelect;
export type XpEvent = typeof xpEvents.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChallengeSubmission = typeof challengeSubmissions.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type AiQueue = typeof aiQueue.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;
export type NewIdeaComment = typeof ideaComments.$inferInsert;
export type NewIdeaLike = typeof ideaLikes.$inferInsert;
export type NewReview = typeof reviews.$inferInsert;
export type NewGenesisHash = typeof genesisHashes.$inferInsert;
export type NewXpEvent = typeof xpEvents.$inferInsert;
export type NewChallenge = typeof challenges.$inferInsert;
export type NewChallengeSubmission = typeof challengeSubmissions.$inferInsert;
export type NewReport = typeof reports.$inferInsert;
export type NewNotification = typeof notifications.$inferInsert;
export type NewFollow = typeof follows.$inferInsert;
export type NewAiQueue = typeof aiQueue.$inferInsert;
