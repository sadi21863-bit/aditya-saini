"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/app/actions/roomActions";
import { Globe, Lock, Loader2 } from "lucide-react";

const CATEGORIES = [
  "Technology", "Design", "Business", "Science", "Education",
  "Art", "Health", "Finance", "Social Impact",
];

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

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1.5">
          Room name <span className="text-red-400">*</span>
        </label>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. AI for Agriculture"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
            placeholder-slate-500 text-sm focus:outline-none focus:border-teal-600 transition"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1.5">
          Description
        </label>
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          placeholder="What is this room about? What kind of ideas will you explore here?"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
            placeholder-slate-500 text-sm focus:outline-none focus:border-teal-600 transition resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1.5">
          Category
        </label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setCategoryMode("preset")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              categoryMode === "preset"
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
            }`}
          >
            Pick a category
          </button>
          <button
            type="button"
            onClick={() => setCategoryMode("custom")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              categoryMode === "custom"
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
            }`}
          >
            Custom
          </button>
        </div>
        {categoryMode === "preset" ? (
          <select
            name="category"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
              text-sm focus:outline-none focus:border-teal-600 transition"
          >
            <option value="">— Select a category —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            name="category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            maxLength={50}
            placeholder="e.g. Robotics, Music Production, Urban Farming..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
              placeholder-slate-500 text-sm focus:outline-none focus:border-teal-600 transition"
          />
        )}
      </div>

      {/* Visibility toggle */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          Visibility
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex-1
              ${visibility === "private"
                ? "bg-slate-700 border-teal-600 text-white"
                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
          >
            <Lock size={14} />
            <div className="text-left">
              <p className="font-semibold">Private</p>
              <p className="text-xs opacity-70">Invite-only</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVisibility("public")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex-1
              ${visibility === "public"
                ? "bg-slate-700 border-teal-600 text-white"
                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
          >
            <Globe size={14} />
            <div className="text-left">
              <p className="font-semibold">Public</p>
              <p className="text-xs opacity-70">Anyone can join</p>
            </div>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold
          py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
        {isPending ? "Creating…" : "Create Room"}
      </button>
    </form>
  );
}
