import { notFound, redirect } from "next/navigation";
import { getRoomWithMembers } from "@/app/actions/roomActions";
import { requireAuth } from "@/lib/auth";
import RoomSettingsForm from "@/components/RoomSettingsForm";
import RoomInviteModal from "@/components/RoomInviteModal";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
        className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ic-muted hover:text-ic-ink transition mb-6"
      >
        <ChevronLeft size={13} /> Back to room
      </Link>

      <h1 className="font-display text-3xl font-normal text-ic-ink mb-1">
        Settings
      </h1>
      <p className="font-mono text-[12px] text-ic-muted mb-8">{room.name}</p>

      <div className="bg-ic-card border border-ic-rule rounded-2xl p-6 mb-6">
        <RoomSettingsForm
          room={room}
          members={members}
          callerId={callerId}
          callerRole={callerMembership.role}
        />
      </div>

      {/* Invite section */}
      <div id="invite" className="bg-ic-card border border-ic-rule rounded-2xl p-6">
        <h2 className="font-display text-lg text-ic-ink mb-4">Invite Members</h2>
        <RoomInviteModal roomId={roomId} />
      </div>
    </div>
  );
}
