import { db } from "@/db";
import { ideas, users, ideaLikes } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import IdeaCard from "@/components/IdeaCard";
import Link from "next/link";
import { Plus } from "lucide-react";

interface Props {
  roomId: string;
  viewerId: string | null;
  isMember: boolean;
}

export default async function RoomIdeasFeed({ roomId, viewerId, isMember }: Props) {
  const roomIdeas = await db
    .select({
      idea: ideas,
      author: { handle: users.handle, name: users.name },
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.userId, users.id))
    .where(and(eq(ideas.roomId, roomId), eq(ideas.status, "published")))
    .orderBy(desc(ideas.createdAt));

  const likedIds: string[] = [];
  if (viewerId) {
    const liked = await db
      .select({ ideaId: ideaLikes.ideaId })
      .from(ideaLikes)
      .where(eq(ideaLikes.userId, viewerId));
    likedIds.push(...liked.map((l) => l.ideaId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Ideas</h2>
        {isMember && (
          <Link
            href={`/rooms/${roomId}/new-idea`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white
              bg-teal-600 hover:bg-teal-500 rounded-lg transition"
          >
            <Plus size={13} /> New Idea
          </Link>
        )}
      </div>

      {roomIdeas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center">
          <p className="text-slate-500 text-sm">No ideas yet.</p>
          {isMember && (
            <Link
              href={`/rooms/${roomId}/new-idea`}
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-sm font-bold
                text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition"
            >
              <Plus size={14} /> Post the first idea
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {roomIdeas.map(({ idea, author }) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              author={author}
              viewerId={viewerId ?? ""}
              hasLiked={likedIds.includes(idea.id)}
              showActions
            />
          ))}
        </div>
      )}
    </div>
  );
}
