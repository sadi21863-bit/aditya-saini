import { db } from "@/db";
import { ideas, users, rooms, roomMembers } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import IdeaCard from "@/components/IdeaCard";
import { Users, Plus, Lock, Globe } from "lucide-react";

export default async function DashboardPage() {
  let userId: string;
  try { userId = await requireAuth(); }
  catch { redirect("/sign-in"); }

  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!me?.handle) redirect("/onboarding");

  // Get all rooms the user is a member of
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

  // Get user's recent ideas across all rooms
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
          <h1 className="text-3xl font-bold text-white">My Rooms</h1>
          <p className="text-slate-400 text-sm mt-1">@{me.handle}</p>
        </div>
        <Link
          href="/rooms/new"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          <Plus size={16} />
          New Room
        </Link>
      </div>

      {/* Rooms Grid */}
      {myMemberships.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">You&apos;re not in any rooms yet.</p>
          <Link
            href="/rooms/new"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Plus size={16} />
            Create Your First Room
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {myMemberships.map((m) => (
            <Link
              key={m.roomId}
              href={`/rooms/${m.roomId}`}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-teal-700/50 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold group-hover:text-teal-400 transition-colors truncate">
                  {m.roomName}
                </h3>
                <div className="flex items-center gap-2">
                  {m.roomVisibility === "private" ? (
                    <Lock size={12} className="text-slate-500" />
                  ) : (
                    <Globe size={12} className="text-teal-500" />
                  )}
                  <span className="text-xs text-slate-500 capitalize">{m.role}</span>
                </div>
              </div>
              {m.roomDescription && (
                <p className="text-slate-400 text-sm line-clamp-2">{m.roomDescription}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Recent Ideas */}
      {recentIdeas.length > 0 && (
        <>
          <h2 className="text-xl font-bold text-white mb-4">Recent Ideas</h2>
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
