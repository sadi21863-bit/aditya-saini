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

  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!me?.handle) redirect("/onboarding");

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create a Room</h1>
        <p className="text-slate-400 text-sm mt-1">
          A room is a shared space for your team to brainstorm and build ideas together.
        </p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <CreateRoomForm />
      </div>
    </div>
  );
}
