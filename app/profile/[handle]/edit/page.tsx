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
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="max-w-xl mx-auto px-6 py-10">

                <div className="mb-8">
                    <Link
                        href={`/profile/${handle}`}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        ← Back to Profile
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-white mb-1">Edit Profile</h1>
                <p className="text-slate-400 text-sm mb-8">@{me.handle}</p>

                {errorParam && errorMessages[errorParam] && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-sm">
                        {errorMessages[errorParam]}
                    </div>
                )}

                <form action={updateProfile} className="flex flex-col gap-6">

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Display Name
                        </label>
                        <input
                            name="name"
                            type="text"
                            defaultValue={me.name ?? ""}
                            placeholder="Your display name"
                            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700
                text-white placeholder:text-slate-500 text-sm focus:outline-none
                focus:ring-2 focus:ring-[#0d9488]/50 focus:border-[#0d9488] transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Handle
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                                @
                            </span>
                            <input
                                name="handle"
                                type="text"
                                defaultValue={me.handle ?? ""}
                                placeholder="yourhandle"
                                required
                                minLength={3}
                                maxLength={30}
                                className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700
                  text-white placeholder:text-slate-500 text-sm focus:outline-none
                  focus:ring-2 focus:ring-[#0d9488]/50 focus:border-[#0d9488] transition"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            3–30 characters. Lowercase letters, numbers, underscores only.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Bio
                        </label>
                        <textarea
                            name="bio"
                            defaultValue={me.bio ?? ""}
                            placeholder="Tell the world about yourself..."
                            maxLength={200}
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700
                text-white placeholder:text-slate-500 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-[#0d9488]/50
                focus:border-[#0d9488] transition"
                        />
                        <p className="text-xs text-slate-500 mt-1">Max 200 characters.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Avatar URL
                        </label>
                        <input
                            name="avatarUrl"
                            type="url"
                            defaultValue={me.avatarUrl ?? ""}
                            placeholder="https://example.com/avatar.png"
                            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700
                text-white placeholder:text-slate-500 text-sm focus:outline-none
                focus:ring-2 focus:ring-[#0d9488]/50 focus:border-[#0d9488] transition"
                        />
                    </div>

                    {me.avatarUrl && (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                            <img
                                src={me.avatarUrl}
                                alt="Current avatar"
                                className="w-14 h-14 rounded-full object-cover border-2 border-[#0d9488]/40"
                            />
                            <div>
                                <p className="text-sm font-semibold text-white">{me.name ?? me.handle}</p>
                                <p className="text-xs text-slate-500">@{me.handle}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-4 pt-2">
                        <button
                            type="submit"
                            className="flex-1 py-3 rounded-xl bg-[#0d9488] hover:bg-teal-500
                text-white font-bold text-sm transition-colors"
                        >
                            Save Changes
                        </button>
                        <Link
                            href={`/profile/${handle}`}
                            className="flex-1 py-3 rounded-xl border border-slate-700
                hover:border-slate-500 text-slate-400 hover:text-white
                font-semibold text-sm text-center transition-colors"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
