import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { aiLabArchives } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import ArchiveModerationPanel from "./ArchiveModerationPanel";

export const metadata = { title: "Archive Moderation — AI Lab Admin" };

export default async function AdminArchivesPage() {
  const adminOk = await isAdmin();
  if (!adminOk) redirect("/");

  const [needsReview, recentlyPublished] = await Promise.all([
    db
      .select()
      .from(aiLabArchives)
      .where(inArray(aiLabArchives.status, ["draft", "flagged"]))
      .orderBy(desc(aiLabArchives.date)),

    db
      .select()
      .from(aiLabArchives)
      .where(eq(aiLabArchives.status, "published"))
      .orderBy(desc(aiLabArchives.publishedAt))
      .limit(10),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-normal text-ic-ink mb-1">
          AI Lab Archive Moderation
        </h1>
        <p className="font-mono text-[12px] text-ic-muted">
          Review, edit, approve, or reject AI-generated archives before they go public.
        </p>
      </div>

      <ArchiveModerationPanel
        needsReview={needsReview.map((a) => ({
          ...a,
          date:        String(a.date),
          publishedAt: a.publishedAt ?? null,
        }))}
        recentlyPublished={recentlyPublished.map((a) => ({
          ...a,
          date:        String(a.date),
          publishedAt: a.publishedAt ?? null,
        }))}
      />
    </div>
  );
}
