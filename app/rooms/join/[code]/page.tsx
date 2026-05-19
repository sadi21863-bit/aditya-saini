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
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="bg-ic-card border border-ic-rule rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <XCircle size={24} className="text-red-500" />
        </div>
        <h1 className="font-display text-2xl font-normal text-ic-ink mb-2">Invite Error</h1>
        <p className="font-mono text-[12px] text-ic-muted mb-6">{errorMsg}</p>
        <Link
          href="/explore"
          className="block w-full px-5 py-2.5 rounded-xl bg-ic-accent hover:opacity-90
            text-white font-medium text-sm transition text-center"
        >
          Explore Rooms
        </Link>
      </div>
    </div>
  );
}
