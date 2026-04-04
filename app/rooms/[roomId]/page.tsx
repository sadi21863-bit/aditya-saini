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
import Link from "next/link";
import { UserPlus } from "lucide-react";

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
    <div className="max-w-4xl mx-auto px-6 py-10">
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
          {/* Join button for non-members on public rooms */}
          {!isMember && room.visibility === "public" && room.status === "active" && (
            <JoinRoomButton roomId={roomId} />
          )}

          {/* Invite button for owners/mods */}
          {canInvite && (
            <Link
              href={`/rooms/${roomId}/settings#invite`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
                bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white
                text-sm font-semibold border border-slate-700 transition"
            >
              <UserPlus size={14} />
              Invite Members
            </Link>
          )}

          <RoomMemberList members={members} callerId={callerId} />
        </div>
      </div>
    </div>
  );
}
