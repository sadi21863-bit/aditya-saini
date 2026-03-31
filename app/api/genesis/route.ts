import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { ideas, genesisHashes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { submitDigest, uploadProofToBlob } from "@/lib/open-timestamps";

// POST /api/genesis
// Initiates OTS timestamping for a private idea the caller owns.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { ideaId } = body ?? {};
  if (!ideaId) return NextResponse.json({ error: "ideaId required" }, { status: 400 });

  // Verify ownership
  const [idea] = await db
    .select({ id: ideas.id, userId: ideas.userId, genesisHash: ideas.genesisHash, domain: ideas.domain })
    .from(ideas)
    .where(eq(ideas.id, ideaId));

  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  if (idea.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (idea.domain !== "private") return NextResponse.json({ error: "Only private ideas get genesis hashes" }, { status: 400 });

  const hash = idea.genesisHash;
  if (!hash) return NextResponse.json({ error: "Idea has no genesis hash yet — publish it first" }, { status: 400 });

  // Check if already timestamped
  const [existing] = await db
    .select({ id: genesisHashes.id, confirmed: genesisHashes.confirmed })
    .from(genesisHashes)
    .where(eq(genesisHashes.ideaId, ideaId));

  if (existing?.confirmed) {
    return NextResponse.json({ status: "already_confirmed" });
  }

  try {
    const proofBytes = await submitDigest(hash);
    const otsBlobUrl = await uploadProofToBlob(ideaId, proofBytes);

    await db
      .insert(genesisHashes)
      .values({ ideaId, hash, otsBlobUrl, confirmed: false })
      .onConflictDoUpdate({
        target: genesisHashes.ideaId,
        set: { otsBlobUrl, confirmed: false },
      });

    return NextResponse.json({ status: "submitted", otsBlobUrl });
  } catch (err) {
    console.error("[genesis] OTS submission failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "OTS submission failed" }, { status: 502 });
  }
}
