export const metadata = { title: "Bookmarks — IdeaConnect" };

import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import Link from "next/link";

export default async function BookmarksPage() {
  let userId = "";
  try {
    userId = await requireAuth();
  } catch {
    redirect("/sign-in");
  }

  if (!userId) redirect("/sign-in");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-lg ic-role-owner flex items-center justify-center shrink-0">
          <Bookmark size={18} />
        </span>
        <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink">Bookmarks</h1>
      </div>
      <p className="font-mono text-[12px] text-ic-muted mb-10 ml-12">
        Ideas you&apos;ve saved for later.
      </p>

      {/* Empty state */}
      <div className="flex flex-col items-center text-center pt-16 pb-8">
        <Bookmark size={48} className="text-ic-rule" />
        <p className="font-display italic text-2xl text-ic-muted mt-4">
          Nothing saved yet.
        </p>
        <p className="font-mono text-[12px] text-ic-muted mt-2">
          Bookmark ideas to read later.
        </p>
        <Link
          href="/feed"
          className="font-mono text-[12px] text-ic-accent hover:text-ic-accent-bright transition-colors mt-4"
        >
          Explore ideas →
        </Link>
      </div>
    </div>
  );
}
