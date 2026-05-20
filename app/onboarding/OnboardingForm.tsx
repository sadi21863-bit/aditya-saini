"use client";
import { useState, useEffect } from "react";
import { createUserProfile, checkHandleAvailability } from "@/app/actions/userActions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
        handleStatus === "available" ? "border-ic-accent" :
        handleStatus === "taken"     ? "border-ic-danger"   :
        "border-ic-rule";

    return (
        <div className="min-h-screen bg-ic-paper flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-8 py-6">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <svg width="22" height="22" viewBox="0 0 22 22">
                        <circle cx="7" cy="11" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
                        <circle cx="15" cy="11" r="2.6" fill="#22C55E" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
                        <path d="M9.6 11 H12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-ic-ink" />
                    </svg>
                    <span className="font-display text-lg font-medium text-ic-ink tracking-tight leading-none">
                        ideaconnect<span className="text-ic-accent-bright">.</span>
                    </span>
                </div>
                {/* Progress dots */}
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-ic-accent" />
                    <span className="w-2 h-2 rounded-full bg-ic-rule" />
                    <span className="font-mono text-[11px] text-ic-muted ml-1">Step 1 of 2</span>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 grid md:grid-cols-2 gap-16 px-8 pb-12 max-w-5xl mx-auto w-full">
                {/* LEFT — form */}
                <div className="max-w-md">
                    <h1 className="font-display text-5xl font-normal tracking-tight text-ic-ink mb-4 leading-tight">
                        Pick your handle.
                    </h1>
                    <p className="text-ic-ink-soft text-base leading-relaxed mb-8">
                        This is your permanent @identity. Choose carefully — handles cannot be changed.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Handle with locked @ prefix */}
                        <div>
                            <label className="block font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1.5">
                                Handle
                            </label>
                            <div className={`flex items-center bg-ic-card border ${handleBorderClass} rounded-lg h-12 px-3 gap-2 transition`}>
                                <span className="font-mono text-sm text-ic-muted select-none flex-shrink-0">@</span>
                                <input
                                    value={handle}
                                    onChange={(e) =>
                                        setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                                    }
                                    placeholder="your_handle"
                                    required
                                    className="flex-1 bg-transparent text-ic-ink text-sm focus:outline-none placeholder:text-ic-muted"
                                />
                                {handleStatus === "checking" && (
                                    <Loader2 size={14} className="text-ic-muted animate-spin flex-shrink-0" />
                                )}
                                {handleStatus === "available" && (
                                    <span className="font-mono text-[12px] text-ic-accent flex-shrink-0">✓ available</span>
                                )}
                                {handleStatus === "taken" && (
                                    <span className="font-mono text-[12px] text-ic-danger shrink-0">✗ taken</span>
                                )}
                            </div>
                            {handleStatus === "taken" && (
                                <p className="text-ic-danger text-xs mt-1.5">That handle is already taken.</p>
                            )}
                            {handleStatus !== "taken" && (
                                <p className="font-mono text-[11px] text-ic-muted mt-1.5">
                                    3–30 characters · lowercase letters, numbers, underscores only · permanent
                                </p>
                            )}
                        </div>

                        {/* Display name */}
                        <div>
                            <label className="block font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1.5">
                                Display name
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                required
                                className="w-full px-4 h-12 rounded-lg border border-ic-rule bg-ic-card text-ic-ink text-sm placeholder:text-ic-muted focus:outline-none focus:border-ic-accent transition"
                            />
                        </div>

                        {error && <p className="text-ic-danger text-sm">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading || handle.length < 3 || name.length < 2 || handleStatus !== "available"}
                            className="w-full py-3 rounded-lg bg-ic-accent text-white text-sm font-medium
                                hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <><Loader2 size={14} className="animate-spin" /> Setting up...</>
                                : "Continue →"}
                        </button>
                    </form>
                </div>

                {/* RIGHT — live IdeaCard preview (desktop only) */}
                <div className="hidden md:flex flex-col pt-2">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">
                        Live preview
                    </p>
                    <div className="bg-ic-card border border-ic-rule rounded-2xl p-6">
                        {/* Room header */}
                        <div className="flex items-center gap-2 pb-4 border-b border-ic-rule-soft mb-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#E5DED1] rounded text-[#4A3A1F] font-mono text-[10px] font-medium tracking-wide">
                                <span className="w-1 h-1 bg-[#4A3A1F] rounded-[1px] opacity-55" />
                                urbanism
                            </span>
                            <span className="font-display text-[15px] text-ic-ink">walkable-cities</span>
                        </div>
                        {/* Idea row */}
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                                <svg width="14" height="14" viewBox="0 0 12 12" fill="#22C55E">
                                    <path d="M6 0.5 L6.7 4.5 L10.5 5.3 L6.9 6.4 L6 11.5 L5.1 6.4 L1.5 5.3 L5.3 4.5 Z" />
                                </svg>
                                <span className="font-mono text-[12px] font-semibold text-ic-ink">3</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-ic-ink leading-relaxed mb-3">
                                    Just joined. Already a few thoughts on this — anyone tried using GPS density as a proxy for pedestrian flow?
                                </p>
                                <div className="flex items-center gap-2 font-mono text-[11px] text-ic-muted">
                                    <div className="w-5 h-5 rounded-[2px] bg-[#D6E2D8] text-[#1F4A2A] flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                                        {handle ? handle[0].toUpperCase() : "?"}
                                    </div>
                                    <span className="text-ic-ink font-medium">@{handle || "handle"}</span>
                                    <span>· just now</span>
                                </div>
                            </div>
                        </div>
                        <p className="font-mono text-[10px] text-ic-muted mt-4 pt-3 border-t border-ic-rule-soft">
                            This is how your handle will appear on ideas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
