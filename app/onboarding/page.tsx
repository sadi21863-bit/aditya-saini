export const metadata = {
  title:       "Get started — IdeaConnect",
  description: "Claim your handle and join the conversation.",
};

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
    const session = await auth();
    const userId  = session?.user?.id;
    if (!userId) redirect("/sign-in");

    const existing = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { password: false },
    });

    if (existing?.handle) redirect("/feed");

    const email = session?.user?.email ?? "";

    return (
        <main className="min-h-screen bg-ic-paper">
            <OnboardingForm userId={userId} email={email} />
        </main>
    );
}
