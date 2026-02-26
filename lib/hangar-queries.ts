import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

export async function getHangarIdeas(userId: string) {
    return await db.select()
        .from(ideas)
        .where(
            and(
                eq(ideas.userId, userId),
                or(
                    eq(ideas.status, "draft"),
                    eq(ideas.status, "archived")
                )
            )
        );
}
