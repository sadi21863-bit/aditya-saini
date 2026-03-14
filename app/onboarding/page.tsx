import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
    const userId = await requireAuth();

    const existing = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (existing?.handle) redirect("/feed");

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
            <div className="w-full max-w-md p-8 bg-slate-900 rounded-2xl border border-slate-800">
                <h1 className="text-2xl font-bold text-white mb-2">
                    Welcome to IdeaConnect
                </h1>
                <p className="text-slate-400 mb-6 text-sm">
                    Set up your identity before anchoring your first idea.
                </p>
                <OnboardingForm userId={userId} />
            </div>
        </main>
    );
}
