"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRoom, archiveRoom, leaveRoom, removeMember, updateMemberRole } from "@/app/actions/roomActions";
import { Globe, Lock, Loader2, AlertTriangle, Crown, Shield, User } from "lucide-react";
import type { Room } from "@/db/schema";

const CATEGORIES = [
  "Technology", "Design", "Business", "Science", "Education",
  "Art", "Health", "Finance", "Social Impact",
];

interface Member {
  userId: string;
  role: string;
  name: string | null;
  handle: string | null;
}

interface Props {
  room: Room;
  members: Member[];
  callerId: string;
  callerRole: string;
}

export default function RoomSettingsForm({ room, members, callerId, callerRole }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<"private" | "public">(
    room.visibility as "private" | "public"
  );
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const isPreset = !room.category || CATEGORIES.includes(room.category);
  const [categoryMode, setCategoryMode] = useState<"preset" | "custom">(isPreset ? "preset" : "custom");
  const [customCategory, setCustomCategory] = useState(isPreset ? "" : (room.category ?? ""));

  const isOwner = callerRole === "owner";

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("visibility", visibility);
    if (categoryMode === "custom" && customCategory.trim()) {
      data.set("category", customCategory.trim());
    }
    setSaveMsg(null);

    startTransition(async () => {
      const result = await updateRoom(room.id, data);
      if (result.success) {
        setSaveMsg({ text: "Saved!", ok: true });
        router.refresh();
      } else {
        const msg = "errors" in result && result.errors
          ? Object.values(result.errors).flat().join(", ")
          : ("error" in result ? result.error : "Failed");
        setSaveMsg({ text: msg ?? "Failed", ok: false });
      }
    });
  }

  function handleArchive() {
    if (!archiveConfirm) { setArchiveConfirm(true); return; }
    startTransition(async () => {
      const result = await archiveRoom(room.id);
      if (result.success) router.push("/dashboard");
    });
  }

  function handleLeave() {
    if (!leaveConfirm) { setLeaveConfirm(true); return; }
    startTransition(async () => {
      const result = await leaveRoom(room.id);
      if (result.success) router.push("/dashboard");
      else if ("error" in result && result.error) {
        const LEAVE_ERRORS: Record<string, string> = {
          not_a_member:      "You are not a member of this room.",
          owner_cannot_leave: "message" in result ? (result as { message: string }).message : "Room owners cannot leave.",
          cannot_leave_ai_lab: "You cannot leave the AI Lab room.",
        };
        setSaveMsg({ text: LEAVE_ERRORS[result.error] ?? result.error, ok: false });
      }
    });
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const result = await updateMemberRole(room.id, userId, newRole);
    if (!result.success && "error" in result) setSaveMsg({ text: result.error ?? "Failed", ok: false });
    else router.refresh();
  }

  async function handleRemove(userId: string) {
    const result = await removeMember(room.id, userId);
    if (!result.success && "error" in result) setSaveMsg({ text: result.error ?? "Failed", ok: false });
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Room details form */}
      <section>
        <h2 className="text-base font-bold text-white mb-4">Room Details</h2>
        <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={room.name}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
                text-sm focus:outline-none focus:border-teal-600 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Description</label>
            <textarea
              name="description"
              maxLength={500}
              rows={3}
              defaultValue={room.description ?? ""}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
                text-sm focus:outline-none focus:border-teal-600 transition resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Category</label>
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
                defaultValue={isPreset ? (room.category ?? "") : ""}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
                  text-sm focus:outline-none focus:border-teal-600 transition"
              >
                <option value="">— Select —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Visibility</label>
            <div className="flex gap-3">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex-1
                    ${visibility === v ? "bg-slate-700 border-teal-600 text-white" : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"}`}
                >
                  {v === "private" ? <Lock size={14} /> : <Globe size={14} />}
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>
          </div>

          {saveMsg && (
            <p className={`text-sm ${saveMsg.ok ? "text-teal-400" : "text-red-400"}`}>{saveMsg.text}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="self-start px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50
              text-white font-bold text-sm transition flex items-center gap-2"
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
        </form>
      </section>

      {/* Members management */}
      <section>
        <h2 className="text-base font-bold text-white mb-4">Members</h2>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-3 bg-slate-800/50 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-teal-900 border border-teal-700 flex items-center justify-center text-[11px] font-bold text-teal-300 shrink-0">
                  {m.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {m.name ?? "Unknown"}
                    {m.userId === callerId && <span className="ml-1 text-slate-500 font-normal">(you)</span>}
                  </p>
                  <p className="text-[10px] text-slate-500">@{m.handle ?? "—"} · <span className="capitalize">{m.role}</span></p>
                </div>
              </div>

              {isOwner && m.userId !== callerId && m.role !== "owner" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    defaultValue={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                  </select>
                  <button
                    onClick={() => handleRemove(m.userId)}
                    className="px-2 py-1 rounded-lg text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 transition"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Danger zone */}
      <section className="border-t border-slate-800 pt-8">
        <h2 className="text-base font-bold text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h2>
        <div className="flex flex-col gap-3">
          {isOwner && room.status === "active" && (
            <div className="flex items-center justify-between bg-red-900/10 border border-red-800/30 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Archive this room</p>
                <p className="text-xs text-slate-400">The room becomes read-only. Ideas are preserved.</p>
              </div>
              <button
                onClick={handleArchive}
                disabled={isPending}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                  archiveConfirm ? "bg-red-600 text-white animate-pulse" : "border border-red-700 text-red-400 hover:bg-red-900/40"
                }`}
              >
                {archiveConfirm ? "Confirm?" : "Archive"}
              </button>
            </div>
          )}

          {!isOwner && (
            <div className="flex items-center justify-between bg-red-900/10 border border-red-800/30 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Leave this room</p>
                <p className="text-xs text-slate-400">You will lose access to private ideas.</p>
              </div>
              <button
                onClick={handleLeave}
                disabled={isPending}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                  leaveConfirm ? "bg-red-600 text-white animate-pulse" : "border border-red-700 text-red-400 hover:bg-red-900/40"
                }`}
              >
                {leaveConfirm ? "Confirm?" : "Leave"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
