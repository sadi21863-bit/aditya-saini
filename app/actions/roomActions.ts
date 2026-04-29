"use server";

import { db } from "@/db";
import { rooms, roomMembers, roomInvites, users, ideas } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";
import { createNotification } from "@/app/actions/notificationActions";

// ─── Schemas ─────────────────────────────────────────────────────────
const RoomWriteSchema = z.object({
  name:        z.string().min(1, "Name is required").max(80),
  description: z.string().max(500).optional().default(""),
  category:    z.string().max(50).optional(),
  visibility:  z.enum(["public", "private"]),
});

// ─── Role helpers ────────────────────────────────────────────────────
type RoomRole = "owner" | "moderator" | "member";
const ROLE_RANK: Record<RoomRole, number> = { owner: 3, moderator: 2, member: 1 };

async function getMembership(roomId: string, userId: string) {
  const [member] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  return member ?? null;
}

async function assertRole(roomId: string, userId: string, minRole: RoomRole) {
  const member = await getMembership(roomId, userId);
  if (!member) throw new Error("Not a member of this room");
  if (ROLE_RANK[member.role as RoomRole] < ROLE_RANK[minRole])
    throw new Error("Insufficient permissions");
  return member;
}

// ─── CREATE ROOM ─────────────────────────────────────────────────────
export async function createRoom(formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const parsed = RoomWriteSchema.safeParse({
    name:        formData.get("name"),
    description: formData.get("description") || "",
    category:    formData.get("category") || undefined,
    visibility:  formData.get("visibility"),
  });
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const { name, description, category, visibility } = parsed.data;

  const [room] = await db
    .insert(rooms)
    .values({ name, description, category, visibility, creatorId: callerId, status: "active" })
    .returning({ id: rooms.id });

  await db.insert(roomMembers).values({ roomId: room.id, userId: callerId, role: "owner" });

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { success: true, roomId: room.id };
}

// ─── UPDATE ROOM ─────────────────────────────────────────────────────
// owner or moderator
export async function updateRoom(roomId: string, formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  try { await assertRole(roomId, callerId, "moderator"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  const parsed = RoomWriteSchema.safeParse({
    name:        formData.get("name"),
    description: formData.get("description") || "",
    category:    formData.get("category") || undefined,
    visibility:  formData.get("visibility"),
  });
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const { name, description, category, visibility } = parsed.data;
  await db
    .update(rooms)
    .set({ name, description, category, visibility, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/settings`);
  return { success: true };
}

// ─── DELETE ROOM ─────────────────────────────────────────────────────
// owner only — hard delete; cascades to members, invites, ideas
export async function deleteRoom(roomId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  try { await assertRole(roomId, callerId, "owner"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  await db.delete(rooms).where(eq(rooms.id, roomId));

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── ARCHIVE ROOM ────────────────────────────────────────────────────
// owner only
export async function archiveRoom(roomId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  try { await assertRole(roomId, callerId, "owner"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  await db
    .update(rooms)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/rooms");
  return { success: true };
}

// ─── JOIN PUBLIC ROOM ─────────────────────────────────────────────────
// one-click join for public rooms
export async function joinPublicRoom(roomId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return { success: false, error: "Room not found" };
  if (room.visibility !== "public") return { success: false, error: "This room is invite-only" };
  if (room.status === "archived") return { success: false, error: "This room is archived" };
  if (room.isAiLab) return { success: false, error: "cannot_join_ai_lab", message: "The AI Lab is managed by AI agents and cannot be joined directly." };

  const existing = await getMembership(roomId, callerId);
  if (existing) return { success: false, error: "Already a member" };

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));
  if (memberCount >= room.maxMembers) return { success: false, error: "Room is full" };

  await db.insert(roomMembers).values({ roomId, userId: callerId, role: "member" });

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/explore");
  return { success: true };
}

// ─── LEAVE ROOM ──────────────────────────────────────────────────────
// any member; sole owner must transfer ownership first
export async function leaveRoom(roomId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "unauthenticated" as const };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const member = await getMembership(roomId, callerId);
  if (!member) return { success: false, error: "not_a_member" as const };

  // Load room to check AI Lab flag
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return { success: false, error: "not_a_member" as const };

  if (room.isAiLab) {
    return { success: false, error: "cannot_leave_ai_lab" as const };
  }

  if (member.role === "owner") {
    return {
      success:  false,
      error:    "owner_cannot_leave" as const,
      message:  "Room owners cannot leave. Transfer ownership or delete the room.",
    };
  }

  await db.delete(roomMembers).where(
    and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, callerId))
  );

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── INVITE MEMBER ────────────────────────────────────────────────────
// owner/mod; sends in-app notification
export async function inviteMember(roomId: string, targetUserId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  try { await assertRole(roomId, callerId, "moderator"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  const [room] = await db
    .select({ name: rooms.name, maxMembers: rooms.maxMembers })
    .from(rooms)
    .where(eq(rooms.id, roomId));
  if (!room) return { success: false, error: "Room not found" };

  const existing = await getMembership(roomId, targetUserId);
  if (existing) return { success: false, error: "User is already a member" };

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));
  if (memberCount >= room.maxMembers) return { success: false, error: "Room is full" };

  // Avoid duplicate pending invites
  const [pending] = await db
    .select({ id: roomInvites.id })
    .from(roomInvites)
    .where(
      and(
        eq(roomInvites.roomId, roomId),
        eq(roomInvites.inviteeId, targetUserId),
        eq(roomInvites.status, "pending"),
      )
    );
  if (pending) return { success: false, error: "Invite already sent" };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [invite] = await db
    .insert(roomInvites)
    .values({ roomId, inviterId: callerId, inviteeId: targetUserId, status: "pending", expiresAt })
    .returning({ id: roomInvites.id });

  await createNotification({
    userId: targetUserId,
    type: "room_invite",
    body: `You've been invited to join "${room.name}"`,
    link: `/notifications`,
  });

  return { success: true, inviteId: invite.id };
}

// ─── GENERATE INVITE LINK ─────────────────────────────────────────────
// creates a unique short code; returns the code for building the URL
export async function generateInviteLink(roomId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  try { await assertRole(roomId, callerId, "moderator"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(roomInvites).values({
    roomId, inviterId: callerId, status: "pending", inviteCode, expiresAt,
  });

  return { success: true, inviteCode };
}

// ─── ACCEPT INVITE (by invite ID) ────────────────────────────────────
// for in-app notifications where we have the inviteId
export async function acceptInvite(inviteId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const [invite] = await db.select().from(roomInvites).where(eq(roomInvites.id, inviteId));
  if (!invite) return { success: false, error: "Invite not found" };
  if (invite.status !== "pending") return { success: false, error: "Invite is no longer valid" };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    await db.update(roomInvites).set({ status: "expired" }).where(eq(roomInvites.id, inviteId));
    return { success: false, error: "Invite has expired" };
  }
  // Targeted invite: verify it's for this caller
  if (invite.inviteeId && invite.inviteeId !== callerId)
    return { success: false, error: "This invite is not for you" };

  const existing = await getMembership(invite.roomId, callerId);
  if (existing) {
    await db.update(roomInvites).set({ status: "accepted" }).where(eq(roomInvites.id, inviteId));
    return { success: true, roomId: invite.roomId };
  }

  const [room] = await db
    .select({ maxMembers: rooms.maxMembers, status: rooms.status })
    .from(rooms)
    .where(eq(rooms.id, invite.roomId));
  if (!room) return { success: false, error: "Room not found" };
  if (room.status === "archived") return { success: false, error: "This room is archived" };

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, invite.roomId));
  if (memberCount >= room.maxMembers) return { success: false, error: "Room is full" };

  await db.transaction(async (tx) => {
    await tx.insert(roomMembers).values({ roomId: invite.roomId, userId: callerId, role: "member" });
    await tx.update(roomInvites).set({ status: "accepted" }).where(eq(roomInvites.id, inviteId));
  });

  revalidatePath(`/rooms/${invite.roomId}`);
  return { success: true, roomId: invite.roomId };
}

// ─── ACCEPT INVITE BY CODE ────────────────────────────────────────────
// used by the /rooms/join/[code] page
export async function acceptInviteByCode(code: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const [invite] = await db.select().from(roomInvites).where(eq(roomInvites.inviteCode, code));
  if (!invite) return { success: false, error: "Invalid invite link" };
  if (invite.status !== "pending") return { success: false, error: "This invite has already been used" };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    await db.update(roomInvites).set({ status: "expired" }).where(eq(roomInvites.id, invite.id));
    return { success: false, error: "This invite link has expired" };
  }

  const existing = await getMembership(invite.roomId, callerId);
  if (existing) return { success: true, roomId: invite.roomId };

  const [room] = await db
    .select({ maxMembers: rooms.maxMembers, status: rooms.status })
    .from(rooms)
    .where(eq(rooms.id, invite.roomId));
  if (!room) return { success: false, error: "Room not found" };
  if (room.status === "archived") return { success: false, error: "This room is archived" };

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, invite.roomId));
  if (memberCount >= room.maxMembers) return { success: false, error: "Room is full" };

  await db.insert(roomMembers).values({ roomId: invite.roomId, userId: callerId, role: "member" });

  revalidatePath(`/rooms/${invite.roomId}`);
  return { success: true, roomId: invite.roomId };
}

// ─── DECLINE INVITE ───────────────────────────────────────────────────
export async function declineInvite(inviteId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const [invite] = await db.select().from(roomInvites).where(eq(roomInvites.id, inviteId));
  if (!invite) return { success: false, error: "Invite not found" };
  if (invite.status !== "pending") return { success: false, error: "Invite is no longer valid" };
  if (invite.inviteeId && invite.inviteeId !== callerId)
    return { success: false, error: "Not your invite" };

  await db.update(roomInvites).set({ status: "declined" }).where(eq(roomInvites.id, inviteId));
  return { success: true };
}

// ─── REMOVE MEMBER ────────────────────────────────────────────────────
// owner or moderator; cannot remove the owner; mods cannot remove mods
export async function removeMember(roomId: string, targetUserId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  let callerMember;
  try { callerMember = await assertRole(roomId, callerId, "moderator"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  const targetMember = await getMembership(roomId, targetUserId);
  if (!targetMember) return { success: false, error: "User is not a member" };
  if (targetMember.role === "owner") return { success: false, error: "Cannot remove the room owner" };
  if (callerMember.role === "moderator" && targetMember.role === "moderator")
    return { success: false, error: "Moderators cannot remove other moderators" };

  await db.delete(roomMembers).where(
    and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, targetUserId))
  );

  revalidatePath(`/rooms/${roomId}`);
  return { success: true };
}

// ─── UPDATE MEMBER ROLE ───────────────────────────────────────────────
// owner only; can set members to moderator and back
export async function updateMemberRole(roomId: string, targetUserId: string, newRole: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const parsedRole = z.enum(["moderator", "member"]).safeParse(newRole);
  if (!parsedRole.success) return { success: false, error: "Invalid role. Must be 'moderator' or 'member'" };

  try { await assertRole(roomId, callerId, "owner"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  if (targetUserId === callerId)
    return { success: false, error: "Cannot change your own role" };

  const targetMember = await getMembership(roomId, targetUserId);
  if (!targetMember) return { success: false, error: "User is not a member" };
  if (targetMember.role === "owner") return { success: false, error: "Cannot change the owner's role" };

  await db
    .update(roomMembers)
    .set({ role: parsedRole.data })
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, targetUserId)));

  revalidatePath(`/rooms/${roomId}`);
  return { success: true };
}

// ─── PIN IDEA ─────────────────────────────────────────────────────────
// owner or moderator; idea must belong to this room
export async function pinIdea(roomId: string, ideaId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  try { await assertRole(roomId, callerId, "moderator"); } catch (e: any) {
    return { success: false, error: e.message };
  }

  const [idea] = await db
    .select({ roomId: ideas.roomId })
    .from(ideas)
    .where(eq(ideas.id, ideaId));
  if (!idea) return { success: false, error: "Idea not found" };
  if (idea.roomId !== roomId) return { success: false, error: "Idea does not belong to this room" };

  await db
    .update(rooms)
    .set({ pinnedIdeaId: ideaId, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  revalidatePath(`/rooms/${roomId}`);
  return { success: true };
}

// ─── GET ROOM WITH MEMBERS ────────────────────────────────────────────
// public rooms are visible to anyone; private rooms require membership
export async function getRoomWithMembers(roomId: string) {
  const callerId = await getAuthenticatedUserId();

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return null;

  if (room.visibility === "private") {
    if (!callerId) return null;
    const member = await getMembership(roomId, callerId);
    if (!member) return null;
  }

  const members = await db
    .select({
      id:        roomMembers.id,
      userId:    roomMembers.userId,
      role:      roomMembers.role,
      joinedAt:  roomMembers.joinedAt,
      name:      users.name,
      handle:    users.handle,
      avatarUrl: users.avatarUrl,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, roomId));

  const callerMembership = callerId
    ? (members.find((m) => m.userId === callerId) ?? null)
    : null;

  return { room, members, callerMembership };
}

// ─── GET MY ROOMS ─────────────────────────────────────────────────────
// all rooms the caller belongs to (for dashboard / sidebar)
export async function getMyRooms() {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return [];

  const { success } = await lightLimiter.limit(callerId);
  if (!success) return [];

  return db
    .select({
      id:          rooms.id,
      name:        rooms.name,
      description: rooms.description,
      category:    rooms.category,
      visibility:  rooms.visibility,
      status:      rooms.status,
      creatorId:   rooms.creatorId,
      maxMembers:  rooms.maxMembers,
      createdAt:   rooms.createdAt,
      role:        roomMembers.role,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
    .where(eq(roomMembers.userId, callerId));
}
