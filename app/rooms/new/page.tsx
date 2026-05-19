import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import CreateRoomForm from "@/components/CreateRoomForm";

export const metadata = { title: "New Room — IdeaConnect" };

export default async function NewRoomPage() {
  let userId: string;
  try { userId = await requireAuth(); }
  catch { redirect("/sign-in"); }

  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { password: false } });
  if (!me?.handle) redirect("/onboarding");

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink">Create a room.</h1>
        <p className="font-mono text-[12px] text-ic-muted mt-2">
          A focused space for a single topic. Smaller scope is better than wider.
        </p>
      </div>
      <div className="bg-ic-card border border-ic-rule rounded-2xl p-6">
        <CreateRoomForm />
      </div>
    </div>
  );
}
