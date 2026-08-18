import LandingContent from "@/components/landing/LandingContent";
import { db } from "@/db";
import { aiLabArchives } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const revalidate = 3600;

export default async function LandingPage() {
  let latestArchive: { date: string; theme: string; summaryMarkdown: string } | null = null;
  try {
    latestArchive = await db.query.aiLabArchives.findFirst({
      where: eq(aiLabArchives.status, "published"),
      orderBy: [desc(aiLabArchives.date)],
      columns: { date: true, theme: true, summaryMarkdown: true },
    }) ?? null;
  } catch {
    // DB not available in preview
  }

  return <LandingContent archive={latestArchive} />;
}