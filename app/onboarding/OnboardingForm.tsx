"use client";
import { useState } from "react";
import { createUserProfile } from "@/app/actions/userActions";
import { useRouter } from "next/navigation";

export default function OnboardingForm({
    userId,
    email,
}: {
    userId: string;
    email: string;
}) {
    const router = useRouter();
    const [handle, setHandle] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");
        const result = await createUserProfile({ userId, handle, name, email });
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            router.push("/feed");
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label className="text-slate-300 text-sm mb-1 block">
                    Display Name
                </label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    required
                    className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700 focus:outline-none focus:border-teal-500"
                />
            </div>
            <div>
                <label className="text-slate-300 text-sm mb-1 block">@handle</label>
                <input
                    value={handle}
                    onChange={(e) =>
                        setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    placeholder="adalovelace"
                    required
                    className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700 focus:outline-none focus:border-teal-500"
                />
                <p className="text-slate-500 text-xs mt-1">
                    Letters, numbers, underscores only. Cannot be changed later.
                </p>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
                type="submit"
                disabled={loading || handle.length < 3 || name.length < 2}
                className="bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {loading ? "Setting up..." : "Enter IdeaConnect →"}
            </button>
        </form>
    );
}
