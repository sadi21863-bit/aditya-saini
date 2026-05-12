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
      <div className="flex items-center gap-3 mb-2">
        <Bookmark size={24} className="text-[#0d9488]" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Saved Ideas</h1>
      </div>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
        Your private collection — only visible to you.
      </p>

      <div className="text-center py-20">
        <Bookmark size={40} className="mx-auto text-gray-300 dark:text-slate-700 mb-4" />
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-2">
          Bookmarks are coming soon in a future update.
        </p>
        <p className="text-gray-400 dark:text-slate-600 text-xs mb-6">
          The bookmarks feature is being redesigned for v15.
        </p>
        <Link
          href="/feed"
          className="inline-block px-5 py-2.5 rounded-xl bg-[#0d9488]
            text-white text-sm font-bold hover:bg-teal-500 transition-colors"
        >
          Browse Ideas →
        </Link>
      </div>
    </div>
  );
}
