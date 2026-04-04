import { notFound, redirect } from "next/navigation";
import { getRoomWithMembers } from "@/app/actions/roomActions";
import { requireAuth } from "@/lib/auth";
import RoomSettingsForm from "@/components/RoomSettingsForm";
import RoomInviteModal from "@/components/RoomInviteModal";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Room Settings — IdeaConnect" };

export default async function RoomSettingsPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  let callerId: string;
  try { callerId = await requireAuth(); }
  catch { redirect("/sign-in"); }

  const data = await getRoomWithMembers(roomId);
  if (!data) notFound();

  const { room, members, callerMembership } = data;

  if (!callerMembership) redirect(`/rooms/${roomId}`);
  if (callerMembership.role === "member") redirect(`/rooms/${roomId}`);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href={`/rooms/${roomId}`}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition"
      >
        <ArrowLeft size={14} /> Back to room
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">
        Settings · <span className="text-slate-400">{room.name}</span>
      </h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <RoomSettingsForm
          room={room}
          members={members}
          callerId={callerId}
          callerRole={callerMembership.role}
        />
      </div>

      {/* Invite section */}
      <div id="invite" className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4">Invite Members</h2>
        <RoomInviteModal roomId={roomId} />
      </div>
    </div>
  );
}
