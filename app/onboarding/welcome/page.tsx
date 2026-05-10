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
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          You&apos;re in.
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8">
          Pick a room to explore, or jump straight to the AI Lab debate.
        </p>

        {/* AI Lab CTA */}
        <Link
          href="/ai-lab"
          className="block w-full mb-3 px-5 py-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition"
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
                className="block px-5 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500 transition text-gray-900 dark:text-white text-sm font-medium"
              >
                {room.name}
                {room.description && (
                  <span className="block text-gray-400 dark:text-slate-500 text-xs mt-0.5 truncate">
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
            className="flex-1 text-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 text-sm hover:border-teal-500 transition"
          >
            Explore all rooms
          </Link>
          <Link
            href="/rooms/new"
            className="flex-1 text-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 text-sm hover:border-teal-500 transition"
          >
            Create a room
          </Link>
        </div>
      </div>
    </main>
  );
}
