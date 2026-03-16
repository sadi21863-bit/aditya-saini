import Link from "next/link";
import { getAuthenticatedUserId } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import NotificationCenter from "@/components/NotificationCenter";

export default async function Navbar() {
  let handle: string | null = null;
  let userId: string | null = null;

  try {
    userId = await getAuthenticatedUserId();
    if (userId) {
      const me = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      handle = me?.handle ?? null;
    }
  } catch {
    // guest
  }

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-8 py-4
      bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">

      {/* Logo */}
      <Link href="/feed" className="flex items-center gap-2 group">
        <span
          className="text-xl font-bold text-slate-900 tracking-tight"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Idea<span className="text-[#0d9488]">Connect</span>
        </span>
      </Link>

      {/* Nav Links */}
      <div className="flex items-center gap-6 text-sm font-medium">
        <Link href="/feed" className="text-slate-500 hover:text-[#0d9488] transition-colors">
          Feed
        </Link>
        <Link href="/leaderboard" className="text-slate-500 hover:text-[#0d9488] transition-colors">
          Leaderboard
        </Link>
        <Link href="/dashboard" className="text-slate-500 hover:text-[#0d9488] transition-colors">
          Dashboard
        </Link>

        {userId ? (
          <>
            {/* Notification Bell */}
            <NotificationCenter userId={userId} />

            {/* Profile Avatar / Handle */}
            {handle && (
              <Link
                href={`/profile/${handle}`}
                className="text-slate-500 hover:text-[#0d9488] font-semibold transition-colors"
              >
                @{handle}
              </Link>
            )}

            {/* Post Idea CTA */}
            <Link
              href="/new"
              className="bg-[#0d9488] text-white px-5 py-2.5 rounded-full
                hover:bg-teal-700 transition-all shadow-sm active:scale-95 font-bold"
            >
              Post Idea
            </Link>
          </>
        ) : (
          <Link
            href="/sign-in"
            className="bg-[#0d9488] text-white px-5 py-2.5 rounded-full
              hover:bg-teal-700 transition-all shadow-sm active:scale-95 font-bold"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
