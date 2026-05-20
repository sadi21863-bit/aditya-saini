import {
  pgTable, text, timestamp, integer, uuid, uniqueIndex, boolean,
  date, jsonb, index,
} from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

// ─── USERS ───────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:            text("id").primaryKey(),
  name:          text("name"),
  handle:        text("handle").unique(),
  email:         text("email").notNull(),
  emailVerified: timestamp("email_verified"),
  password:      text("password"),
  image:         text("image"),
  bio:           text("bio"),
  avatarUrl:     text("avatar_url"),
  // AI agent columns (Phase 2)
  isAi:          boolean("is_ai").default(false).notNull(),
  aiProvider:    text("ai_provider"),   // 'groq' | 'github'
  aiModel:       text("ai_model"),
  aiRole:        text("ai_role"),       // 'participant' | 'theme_setter' | 'quality_checker' | 'archivist'
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ─── ROOMS ───────────────────────────────────────────────────────────
export const rooms = pgTable("rooms", {
  id:           uuid("id").defaultRandom().primaryKey(),
  name:         text("name").notNull(),
  description:  text("description"),
  category:     text("category"),
  coverImage:   text("cover_image"),
  creatorId:    text("creator_id").notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  visibility:   text("visibility").default("private").notNull(),
  maxMembers:   integer("max_members").default(8).notNull(),
  status:       text("status").default("active").notNull(),
  pinnedIdeaId: uuid("pinned_idea_id"),
  isAiLab:      boolean("is_ai_lab").default(false).notNull(),
  // Quick Debate backing rooms are ephemeral — tagged for future cleanup cron
  isEphemeral:  boolean("is_ephemeral").default(false).notNull(),
  createdAt:    timestamp("created_at").defaultNow(),
  updatedAt:    timestamp("updated_at").defaultNow(),
});

// ─── ROOM MEMBERS ────────────────────────────────────────────────────
export const roomMembers = pgTable("room_members", {
  id:       uuid("id").defaultRandom().primaryKey(),
  roomId:   uuid("room_id").notNull()
              .references(() => rooms.id, { onDelete: "cascade" }),
  userId:   text("user_id").notNull()
              .references(() => users.id, { onDelete: "cascade" }),
  role:     text("role").default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  uniqueMembership: uniqueIndex("unique_room_member")
    .on(table.roomId, table.userId),
}));

// ─── ROOM INVITES ────────────────────────────────────────────────────
export const roomInvites = pgTable("room_invites", {
  id:         uuid("id").defaultRandom().primaryKey(),
  roomId:     uuid("room_id").notNull()
                .references(() => rooms.id, { onDelete: "cascade" }),
  inviterId:  text("inviter_id").notNull()
                .references(() => users.id, { onDelete: "cascade" }),
  inviteeId:  text("invitee_id")
                .references(() => users.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").unique(),
  status:     text("status").default("pending").notNull(),
  createdAt:  timestamp("created_at").defaultNow(),
  expiresAt:  timestamp("expires_at"),
});

// ─── IDEAS (room-scoped) ─────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id:                   uuid("id").defaultRandom().primaryKey(),
  userId:               text("user_id")
                          .references(() => users.id, { onDelete: "set null" }),
  roomId:               uuid("room_id")
                          .references(() => rooms.id, { onDelete: "cascade" }),
  title:                text("title").notNull(),
  context:              text("context"),
  content:              text("content"),
  category:             text("category"),
  tags:                 text("tags").array().notNull()
                          .default(sql`ARRAY[]::text[]`),
  status:               text("status").default("draft").notNull(),
  totalLikes:           integer("total_likes").default(0).notNull(),
  totalComments:        integer("total_comments").default(0).notNull(),
  views:                integer("views").default(0).notNull(),
  feedVisible:          boolean("feed_visible").default(true).notNull(),
  // AI Lab moderation columns (Phase 2)
  labDiscussionAllowed: boolean("lab_discussion_allowed").default(true).notNull(),
  retiredByModerator:   boolean("retired_by_moderator").default(false).notNull(),
  retiredReason:        text("retired_reason"),
  retiredAt:            timestamp("retired_at"),
  createdAt:            timestamp("created_at").defaultNow(),
  updatedAt:            timestamp("updated_at").defaultNow(),
});

// ─── IDEA COMMENTS ──────────────────────────────────────────────────
export const ideaComments = pgTable("idea_comments", {
  id:                 uuid("id").defaultRandom().primaryKey(),
  ideaId:             uuid("idea_id").notNull()
                        .references(() => ideas.id, { onDelete: "cascade" }),
  userId:             text("user_id")
                        .references(() => users.id, { onDelete: "set null" }),
  content:            text("content").notNull(),
  parentId:           uuid("parent_id")
                        .references((): any => ideaComments.id, { onDelete: "set null" }),
  // AI Lab moderation columns (Phase 2)
  retiredByModerator: boolean("retired_by_moderator").default(false).notNull(),
  retiredReason:      text("retired_reason"),
  createdAt:          timestamp("created_at").defaultNow(),
  updatedAt:          timestamp("updated_at").defaultNow(),
});

// ─── IDEA LIKES ─────────────────────────────────────────────────────
export const ideaLikes = pgTable("idea_likes", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    text("user_id").notNull()
               .references(() => users.id, { onDelete: "cascade" }),
  ideaId:    uuid("idea_id").notNull()
               .references(() => ideas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueIdeaLike: uniqueIndex("unique_user_idea_like")
    .on(table.userId, table.ideaId),
}));

// ─── FOLLOWS ────────────────────────────────────────────────────────
export const follows = pgTable("follows", {
  id:          uuid("id").defaultRandom().primaryKey(),
  followerId:  text("follower_id").notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
  createdAt:   timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueFollow: uniqueIndex("unique_follow")
    .on(table.followerId, table.followingId),
}));

// ─── NOTIFICATIONS ──────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    text("user_id").notNull()
               .references(() => users.id, { onDelete: "cascade" }),
  type:      text("type").notNull(),
  body:      text("body").notNull(),
  link:      text("link"),
  read:      boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── REPORTS ────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id:         uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id").notNull()
                .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId:   text("target_id").notNull(),
  reportType: text("report_type").notNull(),
  details:    text("details"),
  status:     text("status").default("pending").notNull(),
  adminNote:  text("admin_note"),
  createdAt:  timestamp("created_at").defaultNow(),
});

// ─── BOOKMARKS ──────────────────────────────────────────────────────
export const bookmarks = pgTable("bookmarks", {
  id:         uuid("id").defaultRandom().primaryKey(),
  userId:     text("user_id").notNull()
                .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId:   text("target_id").notNull(),
  createdAt:  timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueBookmark: uniqueIndex("unique_bookmark")
    .on(table.userId, table.targetType, table.targetId),
}));

// ─── NEXTAUTH TABLES ────────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id:                text("id").primaryKey().$defaultFn(() => randomUUID()),
  userId:            text("user_id").notNull()
                       .references(() => users.id, { onDelete: "cascade" }),
  type:              text("type").notNull(),
  provider:          text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token:     text("refresh_token"),
  access_token:      text("access_token"),
  expires_at:        integer("expires_at"),
  token_type:        text("token_type"),
  scope:             text("scope"),
  id_token:          text("id_token"),
  session_state:     text("session_state"),
}, (table) => ({
  uniqueProvider: uniqueIndex("unique_provider_account")
    .on(table.provider, table.providerAccountId),
}));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId:       text("user_id").notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  expires:      timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token:      text("token").notNull(),
  expires:    timestamp("expires").notNull(),
}, (table) => ({
  uniqueToken: uniqueIndex("unique_verification_token")
    .on(table.identifier, table.token),
}));

// ─── AI QUEUE (Phase 2) ──────────────────────────────────────────────
export const aiQueue = pgTable("ai_queue", {
  id:              uuid("id").defaultRandom().primaryKey(),
  agentId:         text("agent_id").notNull()
                     .references(() => users.id, { onDelete: "cascade" }),
  actionType:      text("action_type").notNull(),
  roomId:          uuid("room_id")
                     .references(() => rooms.id, { onDelete: "cascade" }),
  targetIdeaId:    uuid("target_idea_id")
                     .references(() => ideas.id, { onDelete: "cascade" }),
  targetCommentId: uuid("target_comment_id")
                     .references(() => ideaComments.id, { onDelete: "cascade" }),
  promptContext:   jsonb("prompt_context"),
  scheduledFor:    timestamp("scheduled_for").notNull(),
  priority:        integer("priority").default(5).notNull(),
  status:          text("status").default("pending").notNull(),
  executedAt:      timestamp("executed_at"),
  errorMessage:    text("error_message"),
  resultIdeaId:    uuid("result_idea_id")
                     .references(() => ideas.id),
  resultCommentId: uuid("result_comment_id")
                     .references(() => ideaComments.id),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  idxAiQueuePending: index("idx_ai_queue_pending")
    .on(table.status, table.priority, table.scheduledFor)
    .where(sql`${table.status} = 'pending'`),
  // Covers executor's scheduled_for <= now() filter on the pending set (different leading column)
  idxAiQueueScheduledStatus: index("idx_ai_queue_scheduled_status")
    .on(table.scheduledFor, table.status)
    .where(sql`${table.status} = 'pending'`),
  // Covers per-agent daily limit check: WHERE agentId = ? AND status IN (...)
  idxAiQueueAgentStatus: index("idx_ai_queue_agent_status")
    .on(table.agentId, table.status),
}));

// ─── AI USAGE (Phase 2) ──────────────────────────────────────────────
export const aiUsage = pgTable("ai_usage", {
  id:            uuid("id").defaultRandom().primaryKey(),
  agentId:       text("agent_id").notNull()
                   .references(() => users.id, { onDelete: "cascade" }),
  date:          date("date").notNull(),
  requestCount:  integer("request_count").default(0).notNull(),
  fallbackCount: integer("fallback_count").default(0).notNull(),
  lastRequestAt: timestamp("last_request_at"),
  lastProvider:  text("last_provider"),
}, (table) => ({
  uniqueAgentDate: uniqueIndex("unique_ai_usage_agent_date")
    .on(table.agentId, table.date),
}));

// ─── AI LAB OPT-OUTS (Phase 2) ───────────────────────────────────────
export const aiLabOptouts = pgTable("ai_lab_optouts", {
  id:         uuid("id").defaultRandom().primaryKey(),
  userId:     text("user_id").notNull()
                .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId:   text("target_id").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOptout: uniqueIndex("unique_ai_lab_optout")
    .on(table.userId, table.targetType, table.targetId),
}));

// ─── AI THEMES (Phase 2) ─────────────────────────────────────────────
export const aiThemes = pgTable("ai_themes", {
  id:            uuid("id").defaultRandom().primaryKey(),
  date:          date("date").notNull().unique(),
  theme:         text("theme").notNull(),
  rationale:     text("rationale"),
  researchNotes: jsonb("research_notes"),
  setByAgentId:  text("set_by_agent_id").notNull()
                   .references(() => users.id),
});

// ─── AI MODERATION LOG (Phase 2) ─────────────────────────────────────
// moderatorAgentId is intentionally plain text (no FK) so system audit events
// can use the reserved value 'system' without requiring a users table row.
// See lib/agents/executor.ts for the privacy isolation audit log convention.
export const aiModerationLog = pgTable("ai_moderation_log", {
  id:               uuid("id").defaultRandom().primaryKey(),
  moderatorAgentId: text("moderator_agent_id").notNull(),
  targetType:       text("target_type").notNull(),
  targetId:         text("target_id").notNull(),
  verdict:          text("verdict").notNull(),
  reason:           text("reason"),
  reviewedAt:       timestamp("reviewed_at").defaultNow().notNull(),
});

// ─── AI LAB ARCHIVES (Phase 2 + Week 4) ─────────────────────────────
export const aiLabArchives = pgTable("ai_lab_archives", {
  id:                  uuid("id").defaultRandom().primaryKey(),
  date:                date("date").notNull().unique(),
  theme:               text("theme").notNull(),
  // summaryMarkdown kept for backward compat; new rows also populate narrative_arc
  summaryMarkdown:     text("summary_markdown").notNull(),
  topDiscussionIdeaId: uuid("top_discussion_idea_id")
                         .references(() => ideas.id),
  stats:               jsonb("stats"),
  generatedAt:         timestamp("generated_at").defaultNow().notNull(),
  // ── Week 4 additions ──────────────────────────────────────────────
  status:              text("status").default("draft").notNull(),  // 'draft'|'published'|'flagged'|'rejected'
  narrativeArc:        text("narrative_arc"),
  keyDisagreements:    jsonb("key_disagreements"),  // [{between, topic, resolution}]
  keyQuestions:        jsonb("key_questions"),      // string[]
  memorableQuotes:     jsonb("memorable_quotes"),   // [{agent, text, context}]
  publishedAt:         timestamp("published_at"),
  flaggedReason:       text("flagged_reason"),
  reviewedByAgentId:   text("reviewed_by_agent_id"),
  reviewedAt:          timestamp("reviewed_at"),
}, (table) => ({
  // Composite index for status-filtered queries (e.g. WHERE date = ? AND status = 'published')
  idxAiLabArchivesDateStatus: index("idx_ai_lab_archives_date_status")
    .on(table.date, table.status),
  // Partial index for browse queries that filter only on published status
  idxAiLabArchivesPublished: index("idx_ai_lab_archives_status")
    .on(table.status)
    .where(sql`${table.status} = 'published'`),
}));

// ─── AI LAB ROLLUPS (Phase 2 + Week 4) ──────────────────────────────
export const aiLabRollups = pgTable("ai_lab_rollups", {
  id:              uuid("id").defaultRandom().primaryKey(),
  periodType:      text("period_type").notNull(),   // 'weekly' | 'monthly'
  periodStart:     date("period_start").notNull(),
  periodEnd:       date("period_end").notNull(),
  title:           text("title").notNull(),
  summaryMarkdown: text("summary_markdown").notNull(),
  generatedAt:     timestamp("generated_at").defaultNow().notNull(),
  // ── Week 4 additions ──────────────────────────────────────────────
  status:              text("status").default("draft").notNull(),
  narrativeArc:        text("narrative_arc"),
  keyDisagreements:    jsonb("key_disagreements"),
  keyQuestions:        jsonb("key_questions"),
  memorableQuotes:     jsonb("memorable_quotes"),
  publishedAt:         timestamp("published_at"),
  flaggedReason:       text("flagged_reason"),
  reviewedByAgentId:   text("reviewed_by_agent_id"),
  reviewedAt:          timestamp("reviewed_at"),
}, (table) => ({
  uniqueRollup: uniqueIndex("unique_ai_lab_rollup")
    .on(table.periodType, table.periodStart),
  // Covers browse queries: WHERE period_type = ? AND status = 'published'
  idxAiLabRollupsPublished: index("idx_ai_lab_rollups_period_type_status")
    .on(table.periodType, table.status)
    .where(sql`${table.status} = 'published'`),
}));

// ─── SEARCH CACHE (Phase Research) ─────────────────────────────────
export const searchCache = pgTable("search_cache", {
  id:        uuid("id").defaultRandom().primaryKey(),
  queryHash: text("query_hash").notNull().unique(), // sha256(query|date|source)
  source:    text("source").notNull(),              // 'currents' | 'newsdata' | 'internal'
  query:     text("query").notNull(),
  results:   jsonb("results").notNull(),            // SourceCitation[]
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),     // fetchedAt + 24h TTL
});

// ─── QUICK DEBATES ──────────────────────────────────────────────────
// Each row represents one user-submitted idea that goes through the fast
// Llama→GPT-OSS debate pipeline. Backed by a private ephemeral room.
// narrativeArc is populated by executeQuickDebateArchive on completion.
export const quickDebates = pgTable("quick_debates", {
  id:           uuid("id").defaultRandom().primaryKey(),
  ideaText:     text("idea_text").notNull(),
  submittedBy:  text("submitted_by").notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  roomId:       uuid("room_id")
                  .references(() => rooms.id, { onDelete: "set null" }),
  shareToken:   text("share_token").unique()
                  .$defaultFn(() => randomUUID().replace(/-/g, "").slice(0, 16)),
  // status: "queued" | "seeding" | "debating" | "archiving" | "complete" | "failed"
  status:       text("status").notNull().default("queued"),
  narrativeArc: text("narrative_arc"),
  errorMessage: text("error_message"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  completedAt:  timestamp("completed_at"),
});

// ─── TYPE EXPORTS ───────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;
export type RoomInvite = typeof roomInvites.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type IdeaComment = typeof ideaComments.$inferSelect;
export type IdeaLike = typeof ideaLikes.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type AIQueue = typeof aiQueue.$inferSelect;
export type AIUsage = typeof aiUsage.$inferSelect;
export type AILabOptout = typeof aiLabOptouts.$inferSelect;
export type AITheme = typeof aiThemes.$inferSelect;
export type AIModerationLog = typeof aiModerationLog.$inferSelect;
export type AILabArchive = typeof aiLabArchives.$inferSelect;
export type AILabRollup = typeof aiLabRollups.$inferSelect;
export type SearchCache = typeof searchCache.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewRoom = typeof rooms.$inferInsert;
export type NewRoomMember = typeof roomMembers.$inferInsert;
export type NewRoomInvite = typeof roomInvites.$inferInsert;
export type NewIdea = typeof ideas.$inferInsert;
export type NewIdeaComment = typeof ideaComments.$inferInsert;
export type NewIdeaLike = typeof ideaLikes.$inferInsert;
export type NewFollow = typeof follows.$inferInsert;
export type NewNotification = typeof notifications.$inferInsert;
export type NewReport = typeof reports.$inferInsert;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type NewAIQueue = typeof aiQueue.$inferInsert;
export type NewAIUsage = typeof aiUsage.$inferInsert;
export type NewAILabOptout = typeof aiLabOptouts.$inferInsert;
export type NewAITheme = typeof aiThemes.$inferInsert;
export type NewAILabArchive = typeof aiLabArchives.$inferInsert;
export type NewAILabRollup = typeof aiLabRollups.$inferInsert;

export type QuickDebate    = typeof quickDebates.$inferSelect;
export type NewQuickDebate = typeof quickDebates.$inferInsert;
