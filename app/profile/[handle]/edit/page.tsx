import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function ProfileEditPage({
    params,
    searchParams,
}: {
    params: Promise<{ handle: string }>;
    searchParams: Promise<{ error?: string }>;
}) {
    let userId = "";
    try {
        userId = await requireAuth();
    } catch {
        redirect("/sign-in");
    }

    if (!userId) redirect("/sign-in");

    const { handle } = await params;
    const { error: errorParam } = await searchParams;

    const me = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { password: false },
    });

    if (!me) redirect("/sign-in");
    if (!me.handle) redirect("/onboarding");
    if (me.handle !== handle) redirect(`/profile/${me.handle}/edit`);

    async function updateProfile(formData: FormData) {
        "use server";

        let callerId = "";
        try {
            callerId = await requireAuth();
        } catch {
            redirect("/sign-in");
        }

        if (!callerId) redirect("/sign-in");

        const name = (formData.get("name") as string)?.trim();
        const bio = (formData.get("bio") as string)?.trim();
        const avatarUrl = (formData.get("avatarUrl") as string)?.trim();

        // FIX #9: Normalize to lowercase FIRST, then validate with lowercase-only regex
        // Previously used /^[a-zA-Z0-9_]/ which allowed uppercase handles that
        // userActions.ts would then reject — inconsistency allowing invalid handles to slip through
        const newHandle = (formData.get("handle") as string)?.trim().toLowerCase();

        const handleRegex = /^[a-z0-9_]{3,30}$/;
        if (!handleRegex.test(newHandle)) {
            redirect(`/profile/${handle}/edit?error=invalid_handle`);
        }

        const existing = await db.query.users.findFirst({
            where: eq(users.handle, newHandle),
            columns: { password: false },
        });
        if (existing && existing.id !== callerId) {
            redirect(`/profile/${handle}/edit?error=handle_taken`);
        }

        await db
            .update(users)
            .set({
                name: name || null,
                handle: newHandle,
                bio: bio || null,
                avatarUrl: avatarUrl || null,
            })
            .where(eq(users.id, callerId));

        revalidatePath(`/profile/${newHandle}`);
        revalidatePath(`/profile/${handle}`);
        redirect(`/profile/${newHandle}`);
    }

    const errorMessages: Record<string, string> = {
        invalid_handle:
            "Handle must be 3–30 characters. Lowercase letters, numbers and underscores only.",
        handle_taken:
            "That handle is already taken. Please choose another.",
    };

    return (
        <div className="min-h-screen bg-ic-paper">
            <div className="max-w-xl mx-auto px-6 py-10">

                <div className="mb-8">
                    <Link
                        href={`/profile/${handle}`}
                        className="font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors"
                    >
                        ← Back to profile
                    </Link>
                </div>

                <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-2">
                    @{me.handle}
                </p>
                <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink mb-8">
                    Edit Profile
                </h1>

                {errorParam && errorMessages[errorParam] && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                        {errorMessages[errorParam]}
                    </div>
                )}

                <form action={updateProfile} className="flex flex-col gap-5">

                    <div>
                        <label className="block font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1.5">
                            Display Name
                        </label>
                        <input
                            name="name"
                            type="text"
                            defaultValue={me.name ?? ""}
                            placeholder="Your display name"
                            className="w-full px-4 py-3 rounded-xl bg-ic-card border border-ic-rule
                                text-ic-ink placeholder:text-ic-muted text-sm focus:outline-none
                                focus:border-ic-accent transition"
                        />
                    </div>

                    <div>
                        <label className="block font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1.5">
                            Handle
                        </label>
                        <div className="flex items-center bg-ic-card border border-ic-rule rounded-xl h-12 px-3 gap-2 focus-within:border-ic-accent transition">
                            <span className="font-mono text-sm text-ic-muted select-none">@</span>
                            <input
                                name="handle"
                                type="text"
                                defaultValue={me.handle ?? ""}
                                placeholder="yourhandle"
                                required
                                minLength={3}
                                maxLength={30}
                                className="flex-1 bg-transparent text-ic-ink text-sm focus:outline-none placeholder:text-ic-muted"
                            />
                        </div>
                        <p className="font-mono text-[11px] text-ic-muted mt-1.5">
                            3–30 characters · lowercase letters, numbers, underscores only
                        </p>
                    </div>

                    <div>
                        <label className="block font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1.5">
                            Bio
                        </label>
                        <textarea
                            name="bio"
                            defaultValue={me.bio ?? ""}
                            placeholder="Tell the world about yourself…"
                            maxLength={200}
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-ic-card border border-ic-rule
                                text-ic-ink placeholder:text-ic-muted text-sm resize-none
                                focus:outline-none focus:border-ic-accent transition"
                        />
                        <p className="font-mono text-[11px] text-ic-muted mt-1">Max 200 characters.</p>
                    </div>

                    <div>
                        <label className="block font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1.5">
                            Avatar URL
                        </label>
                        <input
                            name="avatarUrl"
                            type="url"
                            defaultValue={me.avatarUrl ?? ""}
                            placeholder="https://example.com/avatar.png"
                            className="w-full px-4 py-3 rounded-xl bg-ic-card border border-ic-rule
                                text-ic-ink placeholder:text-ic-muted text-sm focus:outline-none
                                focus:border-ic-accent transition"
                        />
                    </div>

                    {me.avatarUrl && (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-ic-paper-deep border border-ic-rule">
                            <img
                                src={me.avatarUrl}
                                alt="Current avatar"
                                className="w-14 h-14 rounded-full object-cover border-2 border-ic-rule"
                            />
                            <div>
                                <p className="font-mono text-sm font-semibold text-ic-ink">{me.name ?? me.handle}</p>
                                <p className="font-mono text-[11px] text-ic-muted">@{me.handle}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            className="flex-1 py-3 rounded-xl bg-ic-accent hover:opacity-90
                                text-white font-medium text-sm transition"
                        >
                            Save Changes
                        </button>
                        <Link
                            href={`/profile/${handle}`}
                            className="flex-1 py-3 rounded-xl border border-ic-rule
                                text-ic-muted hover:border-ic-accent hover:text-ic-ink
                                font-medium text-sm text-center transition"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
