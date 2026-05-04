import { db } from "@/db";
import { rooms, roomMembers } from "@/db/schema";
import { eq, ne, desc, count, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import RoomCard from "@/components/RoomCard";
import Link from "next/link";
import { Search, Plus } from "lucide-react";

export const metadata = { title: "Explore Rooms — IdeaConnect" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const callerId = await getAuthenticatedUserId();

  const aiLabRoomId = process.env.AI_LAB_ROOM_ID ?? "";

  // Get public active rooms with member counts, excluding the AI Lab system room
  const publicRooms = await db
    .select({
      id:          rooms.id,
      name:        rooms.name,
      description: rooms.description,
      category:    rooms.category,
      visibility:  rooms.visibility,
      createdAt:   rooms.createdAt,
    })
    .from(rooms)
    .where(
      and(
        eq(rooms.visibility, "public"),
        eq(rooms.status, "active"),
        aiLabRoomId ? ne(rooms.id, aiLabRoomId) : undefined,
      )
    )
    .orderBy(desc(rooms.createdAt));

  // Get member counts per room
  const memberCounts = await db
    .select({ roomId: roomMembers.roomId, cnt: count() })
    .from(roomMembers)
    .groupBy(roomMembers.roomId);
  const countMap = Object.fromEntries(memberCounts.map((r) => [r.roomId, r.cnt]));

  // Get caller's memberships for "Joined" badge
  const myRoomIds = new Set<string>();
  if (callerId) {
    const myMemberships = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, callerId));
    myMemberships.forEach((m) => myRoomIds.add(m.roomId));
  }

  // Build all unique categories for filter
  const allCategories = Array.from(
    new Set(publicRooms.map((r) => r.category).filter(Boolean) as string[])
  ).sort();

  // Filter
  let filtered = publicRooms;
  if (category && category !== "all") {
    filtered = filtered.filter((r) => r.category === category);
  }
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.description?.toLowerCase().includes(lower)
    );
  }

  // Sort by member count desc
  const sorted = filtered
    .map((r) => ({ ...r, memberCount: countMap[r.id] ?? 0 }))
    .sort((a, b) => b.memberCount - a.memberCount);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Explore Rooms</h1>
          <p className="text-slate-400 text-sm mt-1">
            Discover public rooms and join the conversation.
          </p>
        </div>
        {callerId && (
          <Link
            href="/rooms/new"
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white
              text-sm font-semibold px-4 py-2 rounded-lg transition shrink-0"
          >
            <Plus size={15} /> New Room
          </Link>
        )}
      </div>

      {/* Search + category filter */}
      <form method="GET" className="flex flex-wrap gap-3 mb-8">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search rooms…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-2
              text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-600 transition"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Link
            href="/explore"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              !category || category === "all"
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            All
          </Link>
          {allCategories.map((cat) => (
            <Link
              key={cat}
              href={`/explore?category=${encodeURIComponent(cat)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                category === cat
                  ? "bg-teal-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>
      </form>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 mb-4">No public rooms yet.</p>
          {callerId && (
            <Link
              href="/rooms/new"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500
                text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              <Plus size={15} /> Create the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isMember={myRoomIds.has(room.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
