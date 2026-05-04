"use server";

import { db } from "@/db";
import { users, rooms, roomMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { lightLimiter } from "@/lib/ratelimit";

// ─── CREATE USER PROFILE + AUTO-CREATE PERSONAL ROOM ────────────────

export async function createUserProfile(data: {
  userId: string;
  handle: string;
  name: string;
  email: string;
}) {
  const handleRegex = /^[a-z0-9_]{3,30}$/;
  if (!handleRegex.test(data.handle)) {
    return { success: false, error: "Handle must be 3–30 characters: lowercase letters, numbers and underscores only." };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, data.handle))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "Handle already taken" };
  }

  await db
    .insert(users)
    .values({
      id: data.userId,
      handle: data.handle,
      name: data.name,
      email: data.email,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { handle: data.handle, name: data.name },
    });

  // Auto-create personal room for this user
  const [personalRoom] = await db
    .insert(rooms)
    .values({
      name: `@${data.handle}'s workspace`,
      description: "Your personal idea workspace",
      creatorId: data.userId,
      visibility: "private",
      status: "active",
    })
    .returning({ id: rooms.id });

  if (personalRoom) {
    await db.insert(roomMembers).values({
      roomId: personalRoom.id,
      userId: data.userId,
      role: "owner",
    });
  }

  return { success: true };
}

// ─── CHECK HANDLE AVAILABILITY ──────────────────────────────────────

export async function checkHandleAvailability(
  handle: string
): Promise<{ available: boolean }> {
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) return { available: false };
  const existing = await db.query.users.findFirst({ where: eq(users.handle, handle) });
  return { available: !existing };
}

// ─── UPDATE PROFILE ─────────────────────────────────────────────────

export async function updateProfile(data: {
  name: string;
  bio: string;
  avatarUrl?: string;
  handle?: string;
}) {
  const userId = await requireAuth();

  const { success } = await lightLimiter.limit(userId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  if (data.handle) {
    const handleRegex = /^[a-z0-9_]{3,30}$/;
    if (!handleRegex.test(data.handle)) {
      return { success: false, error: "Handle must be 3–30 characters: lowercase letters, numbers, underscores only." };
    }
    const existing = await db.query.users.findFirst({ where: eq(users.handle, data.handle) });
    if (existing && existing.id !== userId) {
      return { success: false, error: "That handle is already taken. Please choose another." };
    }
  }

  await db
    .update(users)
    .set({
      name: data.name || null,
      bio: data.bio || null,
      avatarUrl: data.avatarUrl || null,
      ...(data.handle ? { handle: data.handle } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  return { success: true };
}
