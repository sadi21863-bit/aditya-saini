import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq, desc, ne, and } from "drizzle-orm";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const aiLabRoomId = process.env.AI_LAB_ROOM_ID ?? "";
  const suggestedRooms = await db
    .select({ id: rooms.id, name: rooms.name, description: rooms.description })
    .from(rooms)
    .where(
      and(
        eq(rooms.visibility, "public"),
        eq(rooms.status, "active"),
        aiLabRoomId ? ne(rooms.id, aiLabRoomId) : undefined,
      )
    )
    .orderBy(desc(rooms.createdAt))
    .limit(3);

  return (
    <main className="min-h-screen bg-ic-paper flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <circle cx="7" cy="11" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
            <circle cx="15" cy="11" r="2.6" fill="#22C55E" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
            <path d="M9.6 11 H12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-ic-ink" />
          </svg>
          <span className="font-display text-lg font-medium text-ic-ink tracking-tight leading-none">
            ideaconnect<span className="text-ic-accent-bright">.</span>
          </span>
        </div>
        {/* Progress dots — step 2 active */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ic-accent" />
          <span className="w-2 h-2 rounded-full bg-ic-accent" />
          <span className="font-mono text-[11px] text-ic-muted ml-1">Step 2 of 2</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-8 pb-12 max-w-2xl mx-auto w-full">
        <h1 className="font-display text-5xl font-normal tracking-tight text-ic-ink mb-3 leading-tight">
          You&apos;re in.
        </h1>
        <p className="text-ic-ink-soft text-base leading-relaxed mb-8">
          Pick a room to explore, or jump straight to the AI Lab debate.
        </p>

        {/* AI Lab CTA */}
        <Link
          href="/ai-lab"
          className="block w-full mb-3 px-5 py-4 rounded-xl bg-ic-accent text-white font-medium text-sm hover:opacity-90 transition"
        >
          Watch today&apos;s AI debate →
        </Link>

        {/* Suggested rooms */}
        {suggestedRooms.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {suggestedRooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="block px-5 py-4 rounded-xl border border-ic-rule bg-ic-card hover:border-ic-accent transition text-ic-ink text-sm font-medium"
              >
                <span className="font-display text-base">{room.name}</span>
                {room.description && (
                  <span className="block font-mono text-[11px] text-ic-muted mt-1 truncate">
                    {room.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Or create */}
        <div className="flex gap-3">
          <Link
            href="/explore"
            className="flex-1 text-center px-4 py-3 rounded-xl border border-ic-rule text-ic-muted text-sm hover:border-ic-accent hover:text-ic-ink transition"
          >
            Explore all rooms
          </Link>
          <Link
            href="/rooms/new"
            className="flex-1 text-center px-4 py-3 rounded-xl border border-ic-rule text-ic-muted text-sm hover:border-ic-accent hover:text-ic-ink transition"
          >
            Create a room
          </Link>
        </div>
      </div>
    </main>
  );
}
