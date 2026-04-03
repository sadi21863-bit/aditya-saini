import {
  pgTable, text, timestamp, integer, uuid, uniqueIndex, boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── USERS (trimmed) ─────────────────────────────────────────────────
export const users = pgTable("users", {
  id:        text("id").primaryKey(),
  name:      text("name"),
  handle:    text("handle").unique(),
  email:     text("email").notNull(),
  image:     text("image"),
  bio:       text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// ─── IDEAS (trimmed + room-scoped) ──────────────────────────────────
export const ideas = pgTable("ideas", {
  id:            uuid("id").defaultRandom().primaryKey(),
  userId:        text("user_id")
                   .references(() => users.id, { onDelete: "set null" }),
  roomId:        uuid("room_id")
                   .references(() => rooms.id, { onDelete: "cascade" }),
  title:         text("title").notNull(),
  context:       text("context"),
  content:       text("content"),
  category:      text("category"),
  tags:          text("tags").array().notNull()
                   .default(sql`ARRAY[]::text[]`),
  status:        text("status").default("draft").notNull(),
  totalLikes:    integer("total_likes").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  views:         integer("views").default(0).notNull(),
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ─── IDEA COMMENTS ──────────────────────────────────────────────────
export const ideaComments = pgTable("idea_comments", {
  id:        uuid("id").defaultRandom().primaryKey(),
  ideaId:    uuid("idea_id").notNull()
               .references(() => ideas.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull()
               .references(() => users.id, { onDelete: "cascade" }),
  content:   text("content").notNull(),
  parentId:  uuid("parent_id")
               .references((): any => ideaComments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
