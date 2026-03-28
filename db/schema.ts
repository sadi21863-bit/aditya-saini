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
// 1. USERS — shared across both domains
// tier: starter | builder | architect | grand_architect
// xp: unified pool from both Vault and Commons activity
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  handle: text("handle").unique(),
  email: text("email").notNull(),
  image: text("image"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),

  // v12: ONE unified xp + ONE tier field
  xp: integer("xp").default(0).notNull(),
  tier: text("tier").default("starter").notNull(), // starter | builder | architect | grand_architect

  // Legacy score kept for migration compatibility
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IDEAS — Genesis Vault only (domain: "vault")
// genesisHash: auto-generated on submission, unique fingerprint
// ipProtected: whether IP Protection toggle was enabled
// aiSummary: cached AI analysis JSON — null until owner requests it
// aiStatus: null | "queued" | "processing" | "done" | "failed"
// aiQueuedAt: timestamp when queued (for wait-time estimation)
// ─────────────────────────────────────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

  domain: text("domain").default("vault").notNull(), // always "vault" for this table

  title: text("title").notNull(),
  context: text("context"),
  content: text("content"),
  category: text("category"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").default("draft").notNull(), // draft | published

  ipProtected: boolean("ip_protected").default(false).notNull(),
  genesisHash: text("genesis_hash"), // auto-generated on submit, nullable

  totalLikes: integer("total_likes").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  aiMetadata: jsonb("ai_metadata"),
  editorsPick: boolean("editors_pick").default(false).notNull(),

  // ── AI Summary fields (Change 2) ──────────────────────────────────────────
  // Opt-in only, Vault ideas only, owner-triggered, cached permanently once set
  aiSummary: text("ai_summary"),          // null | JSON string of AIAnalysisResult
  aiStatus: text("ai_status"),            // null | "queued" | "processing" | "done" | "failed"
  aiQueuedAt: timestamp("ai_queued_at"),  // null until queued

  remixedFromId: uuid("remixed_from_id").references((): any => ideas.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. IDEA COMMENTS — Genesis Vault comments
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
  parentId: uuid("parent_id"), // for threaded replies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. IDEA LIKES — Genesis Vault likes
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
// 5. COMMUNITY IDEAS — Idea Commons only (domain: "commons")
// No genesisHash, no IP protection — open collaboration
// ─────────────────────────────────────────────────────────────────────────────
export const communityIdeas = pgTable("community_ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

  domain: text("domain").default("commons").notNull(), // always "commons"

  title: text("title").notNull(),
  context: text("context"),
  content: text("content"),
  category: text("category"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").default("draft").notNull(), // draft | published

  topic: text("topic"), // optional thread/topic context for Commons
  challengeId: uuid("challenge_id"), // nullable, linked to challenge if submitted

  totalLikes: integer("total_likes").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  views: integer("views").default(0).notNull(),

  aiMetadata: jsonb("ai_metadata"),
  editorsPick: boolean("editors_pick").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMMUNITY COMMENTS — Idea Commons comments (Discourse)
// ─────────────────────────────────────────────────────────────────────────────
export const communityComments = pgTable("community_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityIdeaId: uuid("community_idea_id")
    .notNull()
    .references(() => communityIdeas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: uuid("parent_id"), // for threaded replies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. COMMUNITY LIKES — Idea Commons likes
// ─────────────────────────────────────────────────────────────────────────────
export const communityLikes = pgTable(
  "community_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    communityIdeaId: uuid("community_idea_id")
      .notNull()
      .references(() => communityIdeas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueCommunityLike: uniqueIndex("unique_user_community_like").on(
      table.userId,
      table.communityIdeaId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. CHALLENGES — weekly/monthly admin-set challenges (Commons only)
// ─────────────────────────────────────────────────────────────────────────────
export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  topic: text("topic").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").default("active").notNull(), // active | closed | judged
  winnerId: uuid("winner_id"), // set after judging, references communityIdeas.id
  bonusXp: integer("bonus_xp").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CHALLENGE SUBMISSIONS — join: user → challenge → community idea
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
    communityIdeaId: uuid("community_idea_id")
      .notNull()
      .references(() => communityIdeas.id, { onDelete: "cascade" }),
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
// 10. REPORTS — shared across both domains
// ─────────────────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(), // "vault" | "commons"
  targetId: uuid("target_id").notNull(), // ideaId or communityIdeaId
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").default("pending").notNull(), // pending | reviewed | dismissed
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
  // Types: like | comment | access_request | access_approved | access_declined
  //        idea_of_day | challenge_update | tier_up | follower | ai_ready
  body: text("body").notNull(),
  link: text("link"),
  domain: text("domain"), // "vault" | "commons" | null (system)
  read: boolean("read").default(false).notNull(),
  actionable: boolean("actionable").default(false).notNull(),
  actionPayload: jsonb("action_payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. FOLLOWS — shared
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
// 13. AI QUEUE — rate-limit queue for Vault idea AI analysis (Change 3)
// Entries are created when Groq returns 429. The cron worker processes them.
// ─────────────────────────────────────────────────────────────────────────────
export const aiQueue = pgTable("ai_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),           // queue position (1-based)
  requestedAt: timestamp("requested_at").defaultNow(),
  estimatedAt: timestamp("estimated_at"),            // calculated ETA shown to user
  status: text("status").default("waiting").notNull(), // waiting | processing | done
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type IdeaComment = typeof ideaComments.$inferSelect;
export type IdeaLike = typeof ideaLikes.$inferSelect;
export type CommunityIdea = typeof communityIdeas.$inferSelect;
export type CommunityComment = typeof communityComments.$inferSelect;
export type CommunityLike = typeof communityLikes.$inferSelect;
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
export type NewCommunityIdea = typeof communityIdeas.$inferInsert;
export type NewCommunityComment = typeof communityComments.$inferInsert;
export type NewCommunityLike = typeof communityLikes.$inferInsert;
export type NewChallenge = typeof challenges.$inferInsert;
export type NewChallengeSubmission = typeof challengeSubmissions.$inferInsert;
export type NewReport = typeof reports.$inferInsert;
export type NewNotification = typeof notifications.$inferInsert;
export type NewFollow = typeof follows.$inferInsert;
export type NewAiQueue = typeof aiQueue.$inferInsert;
