"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/app/actions/roomActions";
import { Globe, Lock, Loader2 } from "lucide-react";
import { IC_CATEGORIES, IC_CATEGORY_LABELS } from "@/lib/categories";

const inputCls = "w-full bg-ic-card border border-ic-rule rounded-xl px-4 py-2.5 text-ic-ink placeholder:text-ic-muted text-sm focus:outline-none focus:border-ic-accent transition font-sans";
const labelCls = "block font-mono text-[12px] text-ic-muted uppercase tracking-wide mb-1.5";

export default function CreateRoomForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [error, setError] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<"preset" | "custom">("preset");
  const [customCategory, setCustomCategory] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("visibility", visibility);
    if (categoryMode === "custom" && customCategory.trim()) {
      data.set("category", customCategory.trim());
    }
    setError(null);

    startTransition(async () => {
      const result = await createRoom(data);
      if (!result.success) {
        const msg = "errors" in result && result.errors
          ? Object.values(result.errors).flat().join(", ")
          : ("error" in result ? result.error : "Something went wrong");
        setError(msg ?? "Something went wrong");
        return;
      }
      if ("roomId" in result && result.roomId) {
        router.push(`/rooms/${result.roomId}`);
      }
    });
  }

  const visibilityBtnCls = (v: "private" | "public") =>
    `flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex-1
      focus-visible:ring-2 focus-visible:ring-ic-accent focus-visible:outline-none ${
      visibility === v
        ? "bg-ic-ink text-ic-paper border-ic-ink"
        : "border-ic-rule text-ic-muted hover:border-ic-accent"
    }`;

  const modeBtnCls = (m: "preset" | "custom") =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
      categoryMode === m
        ? "bg-ic-accent text-white"
        : "border border-ic-rule text-ic-muted hover:border-ic-accent"
    }`;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div>
        <label className={labelCls}>
          Room name <span className="text-ic-danger">*</span>
        </label>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. AI for Agriculture"
          className={inputCls}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          placeholder="What is this room about? What kind of ideas will you explore here?"
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Category */}
      <div>
        <label className={labelCls}>Category</label>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setCategoryMode("preset")} className={modeBtnCls("preset")}>
            Pick a category
          </button>
          <button type="button" onClick={() => setCategoryMode("custom")} className={modeBtnCls("custom")}>
            Custom
          </button>
        </div>
        {categoryMode === "preset" ? (
          <select
            name="category"
            className={inputCls}
          >
            <option value="">— Select a category —</option>
            {IC_CATEGORIES.map((c) => (
              <option key={c} value={c}>{IC_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        ) : (
          <input
            name="category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            maxLength={50}
            placeholder="e.g. Robotics, Music Production, Urban Farming..."
            className={inputCls}
          />
        )}
      </div>

      {/* Visibility */}
      <div>
        <label className={labelCls}>Visibility</label>
        <div className="flex gap-3">
          <button type="button" onClick={() => setVisibility("private")} className={visibilityBtnCls("private")}>
            <Lock size={14} />
            <div className="text-left">
              <p className="font-semibold">Private</p>
              <p className="text-xs opacity-70">Invite-only</p>
            </div>
          </button>
          <button type="button" onClick={() => setVisibility("public")} className={visibilityBtnCls("public")}>
            <Globe size={14} />
            <div className="text-left">
              <p className="font-semibold">Public</p>
              <p className="text-xs opacity-70">Anyone can join</p>
            </div>
          </button>
        </div>
      </div>

      {error && (
        <p className="font-mono text-[12px] text-ic-danger">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-ic-accent hover:opacity-90 disabled:opacity-50 text-white font-medium
          py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 size={15} className="animate-spin" />}
        {isPending ? "Creating…" : "Create Room"}
      </button>
    </form>
  );
}
