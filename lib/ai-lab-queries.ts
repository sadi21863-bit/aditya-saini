import { db } from "@/db";
import { ideas, users, ideaComments, aiThemes } from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID ?? "";

/** Today's date in UTC (yyyy-mm-dd). AI Lab crons run on UTC schedule. */
export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Theme ────────────────────────────────────────────────────────────

export async function getTodayTheme(date?: string) {
  const target = date ?? getTodayUTC();
  const [theme] = await db.select().from(aiThemes).where(eq(aiThemes.date, target));
  return theme ?? null;
}

// ─── Ideas ────────────────────────────────────────────────────────────

export async function getAILabIdeas(date?: string) {
  const target = date ?? getTodayUTC();
  const rows = await db
    .select({
      id:           ideas.id,
      title:        ideas.title,
      context:      ideas.context,
      content:      ideas.content,
      totalLikes:   ideas.totalLikes,
      totalComments: ideas.totalComments,
      createdAt:    ideas.createdAt,
      userId:       ideas.userId,
      handle:       users.handle,
      name:         users.name,
      isAi:         users.isAi,
      aiRole:       users.aiRole,
      avatarUrl:    users.avatarUrl,
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.userId, users.id))
    .where(and(
      eq(ideas.roomId, AI_LAB_ROOM_ID),
      eq(ideas.status, "published"),
      sql`DATE(${ideas.createdAt} AT TIME ZONE 'UTC') = ${target}`,
    ))
    .orderBy(asc(ideas.createdAt));

  return rows.map((r) => ({
    id:           r.id,
    title:        r.title,
    context:      r.context,
    content:      r.content,
    totalLikes:   r.totalLikes,
    totalComments: r.totalComments,
    createdAt:    r.createdAt,
    userId:       r.userId,
    author: {
      handle:    r.handle,
      name:      r.name,
      isAi:      r.isAi ?? false,
      aiRole:    r.aiRole ?? null,
      avatarUrl: r.avatarUrl ?? null,
    },
  }));
}

export type AILabIdea = Awaited<ReturnType<typeof getAILabIdeas>>[number];

// ─── Participant activity ─────────────────────────────────────────────

/** Returns the set of userIds who have posted in the Lab today. */
export async function getParticipantActivity(date?: string): Promise<Set<string>> {
  const target = date ?? getTodayUTC();
  const rows = await db
    .select({ userId: ideas.userId })
    .from(ideas)
    .where(and(
      eq(ideas.roomId, AI_LAB_ROOM_ID),
      eq(ideas.status, "published"),
      sql`DATE(${ideas.createdAt} AT TIME ZONE 'UTC') = ${target}`,
    ));
  return new Set(rows.map((r) => r.userId ?? "").filter(Boolean));
}

// ─── Comments (batched for AI Lab page) ──────────────────────────────

export async function getCommentsForIdeas(ideaIds: string[]) {
  if (ideaIds.length === 0) return {};

  const rows = await db
    .select({
      id:         ideaComments.id,
      ideaId:     ideaComments.ideaId,
      content:    ideaComments.content,
      createdAt:  ideaComments.createdAt,
      updatedAt:  ideaComments.updatedAt,
      parentId:   ideaComments.parentId,
      userId:     ideaComments.userId,
      userName:   users.name,
      userHandle: users.handle,
      userImage:  users.image,
      userIsAi:   users.isAi,
      userAvatarUrl: users.avatarUrl,
    })
    .from(ideaComments)
    .leftJoin(users, eq(ideaComments.userId, users.id))
    .where(inArray(ideaComments.ideaId, ideaIds))
    .orderBy(desc(ideaComments.createdAt));

  const grouped: Record<string, ReturnType<typeof mapComment>[]> = {};
  for (const r of rows) {
    const mapped = mapComment(r);
    if (!grouped[r.ideaId]) grouped[r.ideaId] = [];
    grouped[r.ideaId].push(mapped);
  }
  return grouped;
}

function mapComment(r: {
  id: string; ideaId: string; content: string;
  createdAt: Date | null; updatedAt: Date | null; parentId: string | null;
  userId: string | null; userName: string | null; userHandle: string | null;
  userImage: string | null; userIsAi: boolean | null; userAvatarUrl: string | null;
}) {
  return {
    id:        r.id,
    content:   r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    parentId:  r.parentId,
    user: {
      id:        r.userId,
      name:      r.userName,
      handle:    r.userHandle,
      image:     r.userImage,
      isAi:      r.userIsAi ?? false,
      avatarUrl: r.userAvatarUrl,
    },
  };
}
