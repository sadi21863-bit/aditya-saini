import { requireAuth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getRoomWithMembers } from "@/app/actions/roomActions";
import IdeaForm from "@/components/IdeaForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Idea — IdeaConnect" };

export default async function NewIdeaPage({
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

  const { room, callerMembership } = data;
  if (!callerMembership) redirect(`/rooms/${roomId}`);
  if (room.status === "archived") redirect(`/rooms/${roomId}`);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href={`/rooms/${roomId}`}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition"
      >
        <ArrowLeft size={14} /> {room.name}
      </Link>
      <IdeaForm roomId={roomId} />
    </div>
  );
}
