export const metadata = {
  title:       "Dashboard — IdeaConnect",
  description: "Your rooms and ideas.",
};

import { db } from "@/db";
import { ideas, users, rooms, roomMembers } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import IdeaCard from "@/components/IdeaCard";
import { Plus, Lock, Globe } from "lucide-react";

export default async function DashboardPage() {
  let userId: string;
  try { userId = await requireAuth(); }
  catch { redirect("/sign-in"); }

  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { password: false } });
  if (!me?.handle) redirect("/onboarding");

  const myMemberships = await db
    .select({
      roomId: roomMembers.roomId,
      role: roomMembers.role,
      roomName: rooms.name,
      roomDescription: rooms.description,
      roomVisibility: rooms.visibility,
      roomStatus: rooms.status,
      roomCreatedAt: rooms.createdAt,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
    .where(eq(roomMembers.userId, userId))
    .orderBy(desc(rooms.updatedAt));

  const recentIdeas = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), eq(ideas.status, "published")))
    .orderBy(desc(ideas.createdAt))
    .limit(10);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[11px] text-ic-muted uppercase tracking-widest mb-2">
            Welcome back, @{me.handle}
          </p>
          <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink">My Rooms</h1>
        </div>
        <Link
          href="/rooms/new"
          className="flex items-center gap-2 bg-ic-accent hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Plus size={16} />
          New Room
        </Link>
      </div>

      {/* Rooms Grid */}
      {myMemberships.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-ic-muted text-sm mb-3">You&apos;re not in any rooms yet.</p>
          <Link
            href="/explore"
            className="font-mono text-[13px] text-ic-accent hover:text-ic-accent-bright transition"
          >
            Explore rooms →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {myMemberships.map((m) => (
            <Link
              key={m.roomId}
              href={`/rooms/${m.roomId}`}
              className="bg-ic-card border border-ic-rule rounded-2xl p-5 flex flex-col gap-3 min-h-42 hover:border-ic-accent/30 transition-colors group"
            >
              {/* Top row */}
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                  m.role === "owner"
                    ? "ic-role-owner"
                    : "bg-ic-paper-deep text-ic-muted"
                }`}>
                  {m.role}
                </span>
                <div className="flex-1" />
                {m.roomVisibility === "private" ? (
                  <Lock size={12} className="text-ic-muted" />
                ) : (
                  <Globe size={12} className="text-ic-muted" />
                )}
              </div>

              {/* Room name + description */}
              <div className="flex-1">
                <p className="font-display text-lg text-ic-ink group-hover:text-ic-accent transition-colors leading-snug mb-1 truncate">
                  {m.roomName}
                </p>
                {m.roomDescription && (
                  <p className="text-ic-ink-soft text-sm truncate">{m.roomDescription}</p>
                )}
              </div>

              {/* Footer */}
              <div className="font-mono text-[11px] text-ic-muted flex items-center gap-3 mt-auto pt-2 border-t border-ic-rule-soft">
                <span className="capitalize">{m.roomVisibility}</span>
                <span className="flex-1" />
                <span className="text-ic-accent font-medium">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent Ideas */}
      {recentIdeas.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="font-display text-2xl font-normal text-ic-ink">Recent Ideas</h2>
            <div className="flex-1 h-px bg-ic-rule" />
            <Link href="/feed" className="font-mono text-[12px] text-ic-accent hover:text-ic-accent-bright transition">
              View all →
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {recentIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                viewerId={userId}
                isOwner={true}
                showActions={true}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
