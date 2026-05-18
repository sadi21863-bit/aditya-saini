import { notFound, redirect } from "next/navigation";
import { getRoomWithMembers } from "@/app/actions/roomActions";
import { getAuthenticatedUserId } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import RoomHeader from "@/components/RoomHeader";
import RoomIdeasFeed from "@/components/RoomIdeasFeed";
import RoomMemberList from "@/components/RoomMemberList";
import JoinRoomButton from "@/components/JoinRoomButton";
import LeaveRoomButton from "@/components/LeaveRoomButton";
import Link from "next/link";
import { UserPlus, Plus } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const data = await getRoomWithMembers(roomId);
  if (!data) return { title: "Room — IdeaConnect" };
  return { title: `${data.room.name} — IdeaConnect` };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const callerId = await getAuthenticatedUserId();

  const data = await getRoomWithMembers(roomId);
  if (!data) notFound();

  const { room, members, callerMembership } = data;
  const isMember = !!callerMembership;
  const canInvite = callerMembership?.role === "owner" || callerMembership?.role === "moderator";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <RoomHeader
        room={room}
        memberCount={members.length}
        callerRole={callerMembership?.role ?? null}
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main: ideas feed */}
        <div className="flex-1 min-w-0">
          <RoomIdeasFeed
            roomId={roomId}
            viewerId={callerId}
            isMember={isMember}
          />
        </div>

        {/* Sidebar: members + actions */}
        <div className="lg:w-64 shrink-0 flex flex-col gap-4">
          {/* Join button for non-members on public rooms (not AI Lab) */}
          {!isMember && room.visibility === "public" && room.status === "active" && !room.isAiLab && (
            <JoinRoomButton roomId={roomId} />
          )}

          {/* Leave button for members who are not the owner and not the AI Lab */}
          {isMember && callerMembership?.role !== "owner" && !room.isAiLab && (
            <LeaveRoomButton roomId={roomId} />
          )}

          {/* Invite button for owners/mods */}
          {canInvite && (
            <Link
              href={`/rooms/${roomId}/settings#invite`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
                bg-ic-paper-deep border border-ic-rule hover:border-ic-accent
                text-ic-muted hover:text-ic-ink font-mono text-sm font-medium transition"
            >
              <UserPlus size={14} />
              Invite Members
            </Link>
          )}

          <RoomMemberList members={members} callerId={callerId} />
        </div>
      </div>

      {/* Mobile FAB — Post idea, fixed above future bottom nav */}
      {isMember && (
        <Link
          href={`/rooms/${roomId}/new-idea`}
          className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full
            bg-ic-accent text-white shadow-card flex items-center justify-center
            hover:opacity-90 transition"
          aria-label="Post idea"
        >
          <Plus size={22} />
        </Link>
      )}
    </div>
  );
}
