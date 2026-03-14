import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import IdeaCard from "@/components/IdeaCard";
import { db as dbClient } from "@/db";
import { users } from "@/db/schema";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    redirect("/sign-in");
  }

  const { tab } = await searchParams;
  const activeTab = tab ?? "all";

  const me = await dbClient.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!me?.handle) redirect("/onboarding");

  const allIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.createdAt));

  const filtered =
    activeTab === "drafts"
      ? allIdeas.filter((i) => i.status === "draft")
      : activeTab === "launched"
        ? allIdeas.filter((i) => i.status === "public")
        : allIdeas;

  const tabs = [
    { key: "all", label: `All (${allIdeas.length})` },
    {
      key: "drafts",
      label: `Drafts (${allIdeas.filter((i) => i.status === "draft").length})`,
    },
    {
      key: "launched",
      label: `Launched (${allIdeas.filter((i) => i.status === "public").length})`,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">My Workspace</h1>
          <p className="text-slate-400 text-sm mt-1">
            @{me.handle} · {me.xp} XP ·{" "}
            <span className="capitalize">{me.tier}</span>
          </p>
        </div>
        <a
          href="/new"
          className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + New Idea
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/dashboard?tab=${t.key}`}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === t.key
                ? "bg-teal-600 text-white"
                : "text-slate-400 hover:text-white"
              }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Ideas */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          {activeTab === "drafts"
            ? "No drafts yet. Start a new idea."
            : activeTab === "launched"
              ? "No launched ideas yet. Launch a draft to go public."
              : "No ideas yet. Create your first one."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              author={{
                handle: me.handle,
                name: me.name,
                tier: me.tier,
                xp: me.xp,
              }}
              viewerId={userId}
              hasLiked={false}
              isOwner
            />
          ))}
        </div>
      )}
    </div>
  );
}
