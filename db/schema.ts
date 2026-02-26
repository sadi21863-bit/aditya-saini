import { pgTable, text, timestamp, integer, uuid, uniqueIndex } from "drizzle-orm/pg-core";

// 1. Users Table
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk Auth ID
  name: text("name"),
  handle: text("handle").unique(),
  email: text("email").notNull(),
  image: text("image"),
  tier: text("tier").default("Beginner"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. Ideas Table
export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Relationship removed for now to allow testing without existing users
  userId: text("user_id"),
  title: text("title").notNull(),
  hook: text("hook"),
  content: text("content"),
  category: text("category"),
  status: text("status").default("draft"),

  totalLikes: integer("total_likes").default(0),

  genesisCode: text("genesis_code"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 3. Likes Table
export const likes = pgTable("likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  ideaId: uuid("idea_id").references(() => ideas.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueLike: uniqueIndex("unique_user_like").on(table.userId, table.ideaId),
}));