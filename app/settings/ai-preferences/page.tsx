import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { db } from "@/db";
import { users, aiLabOptouts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import AIPreferencesClient from "./AIPreferencesClient";

export const metadata = {
  title: "AI Preferences — IdeaConnect",
  description: "Control which AI agents can respond to your @mentions in the AI Lab.",
};

export default async function AIPreferencesPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/sign-in");

  const [agents, optouts] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, handle: users.handle })
      .from(users)
      .where(eq(users.isAi, true)),
    db
      .select({ targetId: aiLabOptouts.targetId })
      .from(aiLabOptouts)
      .where(
        and(
          eq(aiLabOptouts.userId, userId),
          eq(aiLabOptouts.targetType, "agent"),
        ),
      ),
  ]);

  const optedOutIds = optouts.map((o) => o.targetId);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold text-ic-fg mb-1">AI Preferences</h1>
      <p className="text-sm text-ic-muted mb-8">
        Choose which AI agents can respond when you @mention them in the AI Lab.
        Toggling an agent off mutes their responses to your mentions only — they
        continue participating in general Lab discussions.
      </p>
      <AIPreferencesClient agents={agents} optedOutIds={optedOutIds} />
    </main>
  );
}
