import { redirect } from "next/navigation";
import { acceptInviteByCode } from "@/app/actions/roomActions";
import { getAuthenticatedUserId } from "@/lib/auth";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata = { title: "Join Room — IdeaConnect" };

export default async function JoinRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const callerId = await getAuthenticatedUserId();

  if (!callerId) {
    redirect(`/sign-in?redirect_url=/rooms/join/${code}`);
  }

  const result = await acceptInviteByCode(code);

  if (result.success && "roomId" in result && result.roomId) {
    redirect(`/rooms/${result.roomId}`);
  }

  const errorMsg = "error" in result ? result.error : "Invalid invite link.";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <XCircle size={24} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Invite Error</h1>
        <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
        <Link
          href="/explore"
          className="inline-block px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500
            text-white font-bold text-sm transition"
        >
          Explore Rooms
        </Link>
      </div>
    </div>
  );
}
