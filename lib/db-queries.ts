import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function getAetherFeedData() {
    try {
        return await db
            .select({
                id: ideas.id,
                title: ideas.title,
                hook: ideas.hook,
                content: ideas.content,
                category: ideas.category,
                totalLikes: ideas.totalLikes,
                genesisCode: ideas.genesisCode,
                createdAt: ideas.createdAt,
                user: {
                    id: users.id,
                    name: users.name,
                    tier: users.tier,
                },
            })
            .from(ideas)
            .leftJoin(users, eq(ideas.userId, users.id))
            .where(eq(ideas.status, "public"))
            .orderBy(desc(ideas.createdAt));
    } catch (error) {
        console.error("DB Fetch Error:", error);
        return [];
    }
}
