import { relations } from "drizzle-orm/relations";
import { ideas, likes } from "./schema";

export const likesRelations = relations(likes, ({one}) => ({
	idea: one(ideas, {
		fields: [likes.ideaId],
		references: [ideas.id]
	}),
}));

export const ideasRelations = relations(ideas, ({many}) => ({
	likes: many(likes),
}));