"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { lightLimiter } from "@/lib/ratelimit";

// ─── GET USER BY ID ──────────────────────────────────────────────────
export async function getUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

// ─── UPDATE DISPLAY NAME / BIO / AVATAR ─────────────────────────────
export async function updateProfile(data: {
  name: string;
  bio: string;
  avatarUrl?: string;
}) {
  const userId = await requireAuth();

  const { success } = await lightLimiter.limit(userId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  await db
    .update(users)
    .set({
      name:      data.name || null,
      bio:       data.bio  || null,
      avatarUrl: data.avatarUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  return { success: true };
}
