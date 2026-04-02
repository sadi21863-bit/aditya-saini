import {
  pgTable, text, timestamp, integer, uuid, uniqueIndex, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  handle: text("handle").unique(),
  email: text("email").notNull(),
  image: text("image"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  xp: integer("xp").default(0).notNull(),
  privateXp: integer("private_xp").default(0).notNull(),
  publicXp: integer("public_xp").default(0).notNull(),
  tier: text("tier").default("explorer").notNull(),
  allowRemix: boolean("allow_remix").default(true).notNull(),
  pinnedIdeaIds: text("pinned_idea_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  badges: text("badges").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  domain: text("domain").default("private").notNull(),
  title: text("title").notNull(),
  context: text("context"),
  content: text("content"),
  category: text("category"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").default("draft").notNull(),
  ipProtected: boolean("ip_protected").default(false).notNull(),
  genesisHash: text("genesis_hash"),
  totalLikes: integer("total_likes").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  aiMetadata: jsonb("ai_metadata"),
  editorsPick: boolean("editors_pick").default(false).notNull(),
  aiSummary: text("ai_summary"),
  aiStatus: text("ai_status"),
  aiQueuedAt: timestamp("ai_queued_at"),
  remixedFromId: uuid("remixed_from_id").references((): any => ideas.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ideaComments = pgTable("idea_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: uuid("parent_id").references((): any => ideaComments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ideaLikes = pgTable("idea_likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueIdeaLike: uniqueIndex("unique_user_idea_like").on(table.userId, table.ideaId),
}));

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => ideaComments.id, { onDelete: "set null" }),
  verdict: text("verdict").notNull(),
  rating: integer("rating").notNull(),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueReview: uniqueIndex("unique_user_idea_review").on(table.ideaId, table.userId),
}));

export const genesisHashes = pgTable("genesis_hashes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id").notNull().unique().references(() => ideas.id, { onDelete: "cascade" }),
  hash: text("hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  otsBlobUrl: text("ots_blob_url"),
  confirmed: boolean("confirmed").default(false).notNull(),
});

export const xpEvents = pgTable("xp_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
  xpAwarded: integer("xp_awarded").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  topic: text("topic").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").default("active").notNull(),
  winnerId: uuid("winner_id").references(() => ideas.id, { onDelete: "set null" }),
  bonusXp: integer("bonus_xp").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const challengeSubmissions = pgTable("challenge_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueSubmission: uniqueIndex("unique_challenge_submission").on(table.challengeId, table.userId),
}));

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  targetId: uuid("target_id").notNull(),
  reportType: text("report_type").notNull(),
  details: text("details"),
  status: text("status").default("pending").notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  domain: text("domain"),
  read: boolean("read").default(false).notNull(),
  actionable: boolean("actionable").default(false).notNull(),
  actionPayload: jsonb("action_payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueFollow: uniqueIndex("unique_follow").on(table.followerId, table.followingId),
}));

export const aiQueue = pgTable("ai_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  estimatedAt: timestamp("estimated_at"),
  status: text("status").default("waiting").notNull(),
});

// ─── v14 NEW: PRIOR ART CLAIMS ─────────────────────────────────────────────
export const priorArtClaims = pgTable("prior_art_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimantId: text("claimant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  privateIdeaId: uuid("private_idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  targetPublicIdeaId: uuid("target_public_idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  genesisHash: text("genesis_hash").notNull(),
  genesisTimestamp: timestamp("genesis_timestamp").notNull(),
  similarityScore: integer("similarity_score"),
  status: text("status").default("open").notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueClaim: uniqueIndex("unique_prior_art_claim").on(table.claimantId, table.targetPublicIdeaId),
}));

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
export type PriorArtClaim = typeof priorArtClaims.$inferSelect;
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
export type NewPriorArtClaim = typeof priorArtClaims.$inferInsert;
