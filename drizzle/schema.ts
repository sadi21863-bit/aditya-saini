import { pgTable, uniqueIndex, foreignKey, uuid, text, timestamp, integer, jsonb, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const likes = pgTable("likes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	ideaId: uuid("idea_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_user_like").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.ideaId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ideaId],
			foreignColumns: [ideas.id],
			name: "likes_idea_id_ideas_id_fk"
		}),
]);

export const ideas = pgTable("ideas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	title: text().notNull(),
	hook: text(),
	content: text(),
	category: text(),
	status: text().default('draft').notNull(),
	totalLikes: integer("total_likes").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	views: integer().default(0).notNull(),
	blurLevel: integer("blur_level").default(0).notNull(),
	genesisHash: text("genesis_hash"),
	partnerIds: text("partner_ids").array().default(["RAY"]).notNull(),
	simHash: text("sim_hash"),
	viewerIds: text("viewer_ids").array().default(["RAY"]).notNull(),
	aiMetadata: jsonb("ai_metadata"),
});

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	name: text(),
	email: text().notNull(),
	image: text(),
	tier: text().default('initiate').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	handle: text(),
	xp: integer().default(0).notNull(),
	score: integer().default(0).notNull(),
	bio: text(),
	avatarUrl: text("avatar_url"),
}, (table) => [
	unique("users_handle_unique").on(table.handle),
]);
