"use client";
import { useState, useEffect } from "react";
import { createUserProfile, checkHandleAvailability } from "@/app/actions/userActions";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

type HandleStatus = "idle" | "checking" | "available" | "taken";

export default function OnboardingForm({
    userId,
    email,
}: {
    userId: string;
    email: string;
}) {
    const router = useRouter();
    const [handle, setHandle]               = useState("");
    const [name, setName]                   = useState("");
    const [loading, setLoading]             = useState(false);
    const [error, setError]                 = useState("");
    const [handleStatus, setHandleStatus]   = useState<HandleStatus>("idle");

    // Debounced availability check — fires 300 ms after the user stops typing
    useEffect(() => {
        if (handle.length < 3) { setHandleStatus("idle"); return; }
        setHandleStatus("checking");
        const timer = setTimeout(async () => {
            const { available } = await checkHandleAvailability(handle);
            setHandleStatus(available ? "available" : "taken");
        }, 300);
        return () => clearTimeout(timer);
    }, [handle]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (handleStatus !== "available") return;
        setLoading(true);
        setError("");
        const result = await createUserProfile({ userId, handle, name, email });
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            router.push("/onboarding/welcome");
        }
    }

    const handleBorderClass =
        handleStatus === "available" ? "border-teal-500" :
        handleStatus === "taken"     ? "border-red-500"  :
        "border-slate-700";

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
                <div className="relative">
                    <input
                        value={handle}
                        onChange={(e) =>
                            setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                        }
                        placeholder="your_handle"
                        required
                        className={`w-full bg-slate-800 text-white rounded-lg px-4 py-2 pr-9 border focus:outline-none transition-colors ${handleBorderClass}`}
                    />
                    {handleStatus === "checking" && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                    )}
                    {handleStatus === "available" && (
                        <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400" />
                    )}
                    {handleStatus === "taken" && (
                        <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
                    )}
                </div>
                {handleStatus === "taken" && (
                    <p className="text-red-400 text-xs mt-1">That handle is already taken.</p>
                )}
                {handleStatus !== "taken" && (
                    <p className="text-slate-500 text-xs mt-1">
                        3–30 characters · lowercase letters, numbers, underscores only · permanent
                    </p>
                )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
                type="submit"
                disabled={loading || handle.length < 3 || name.length < 2 || handleStatus !== "available"}
                className="bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {loading ? "Setting up..." : "Enter IdeaConnect →"}
            </button>
        </form>
    );
}
