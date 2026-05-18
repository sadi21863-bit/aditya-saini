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
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-2">
            Public rooms · open to all
          </p>
          <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink leading-tight">
            Find your <em className="italic">kitchen&nbsp;table.</em>
          </h1>
        </div>
        {callerId && (
          <Link
            href="/rooms/new"
            className="flex items-center gap-2 bg-ic-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition shrink-0"
          >
            <Plus size={15} /> New Room
          </Link>
        )}
      </div>

      {/* Search + category filter */}
      <form method="GET" className="mb-6 flex flex-col gap-3">
        {/* Search input */}
        <div className="flex items-center gap-3 bg-ic-card border border-ic-rule rounded-xl px-4 h-11 focus-within:border-ic-accent transition-colors">
          <Search size={14} className="text-ic-muted shrink-0" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search rooms…"
            className="flex-1 bg-transparent text-ic-ink text-sm placeholder:text-ic-muted focus:outline-none"
          />
        </div>

        {/* Category pills — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Link
            href={q ? `/explore?q=${encodeURIComponent(q)}` : "/explore"}
            className={`shrink-0 px-4 py-1.5 rounded-full font-mono text-[11px] font-medium tracking-wide border transition-all whitespace-nowrap ${
              !category || category === "all"
                ? "bg-ic-ink border-ic-ink text-ic-paper"
                : "bg-transparent border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink"
            }`}
          >
            all
          </Link>
          {allCategories.map((cat) => (
            <Link
              key={cat}
              href={`/explore?category=${encodeURIComponent(cat)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`shrink-0 px-4 py-1.5 rounded-full font-mono text-[11px] font-medium tracking-wide border transition-all whitespace-nowrap ${
                category === cat
                  ? "bg-ic-ink border-ic-ink text-ic-paper"
                  : "bg-transparent border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink"
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
          <p className="font-mono text-sm text-ic-muted mb-4">No rooms found.</p>
          {callerId && (
            <Link
              href="/rooms/new"
              className="font-mono text-[13px] text-ic-accent hover:underline"
            >
              Create one →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isMember={myRoomIds.has(room.id)}
              />
            ))}
          </div>
          <div className="mt-8 text-center">
            <span className="font-mono text-[13px] text-ic-muted">load more →</span>
          </div>
        </>
      )}
    </div>
  );
}
