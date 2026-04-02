"use server";

import { db } from "@/db";
import { ideas, genesisHashes, priorArtClaims, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { computeCombinedSimHash, hammingDistance, PRIOR_ART_SIMILARITY_THRESHOLD } from "@/lib/simhash";
import { awardXpForDomain } from "@/lib/xp";
import { createNotification } from "@/app/actions/notificationActions";

// ─── SUBMIT PRIOR ART CLAIM ──────────────────────────────────────────────────
/**
 * File a prior art claim.
 * 7 sequential gates — all must pass:
 * 1. Auth
 * 2. Caller owns private idea
 * 3. Confirmed genesis hash exists
 * 4. Target is public + published
 * 5. SimHash gate (Hamming distance <= PRIOR_ART_SIMILARITY_THRESHOLD)
 * 6. Timestamp gate (genesis.createdAt < target.createdAt)
 * 7. DB insert (unique constraint prevents duplicates)
 */
export async function submitPriorArtClaim(
  privateIdeaId: string,
  targetPublicIdeaId: string
): Promise<{ success: boolean; error?: string; similarityScore?: number }> {
  const userId = await requireAuth();

  // Gate 2
  const [privateIdea] = await db
    .select({ id: ideas.id, userId: ideas.userId, domain: ideas.domain, title: ideas.title, content: ideas.content, createdAt: ideas.createdAt })
    .from(ideas).where(eq(ideas.id, privateIdeaId));

  if (!privateIdea) return { success: false, error: "Private idea not found" };
  if (privateIdea.userId !== userId) return { success: false, error: "You do not own this idea" };
  if (privateIdea.domain !== "private") return { success: false, error: "Only private ideas can be used as prior art" };

  // Gate 3
  const [genesis] = await db
    .select({ hash: genesisHashes.hash, createdAt: genesisHashes.createdAt, confirmed: genesisHashes.confirmed })
    .from(genesisHashes)
    .where(and(eq(genesisHashes.ideaId, privateIdeaId), eq(genesisHashes.confirmed, true)));

  if (!genesis) return { success: false, error: "No confirmed genesis hash found. Your idea must be Bitcoin-anchored before filing a claim." };

  // Gate 4
  const [targetIdea] = await db
    .select({ id: ideas.id, userId: ideas.userId, domain: ideas.domain, status: ideas.status, title: ideas.title, content: ideas.content, createdAt: ideas.createdAt })
    .from(ideas).where(eq(ideas.id, targetPublicIdeaId));

  if (!targetIdea) return { success: false, error: "Target idea not found" };
  if (targetIdea.domain !== "public") return { success: false, error: "Target must be a public idea" };
  if (targetIdea.status !== "published") return { success: false, error: "Target idea is not published" };

  // Gate 5: SimHash similarity
  let distance: number;
  try {
    const privateHash = computeCombinedSimHash(privateIdea.title, privateIdea.content ?? "");
    const targetHash  = computeCombinedSimHash(targetIdea.title, targetIdea.content ?? "");
    distance = hammingDistance(privateHash, targetHash);
  } catch {
    return { success: false, error: "Content too short for similarity analysis. Expand your idea before filing." };
  }

  if (distance > PRIOR_ART_SIMILARITY_THRESHOLD) {
    const similarityPct = Math.round(((64 - distance) / 64) * 100);
    return {
      success: false,
      error: `Ideas are not similar enough (${similarityPct}% similarity — minimum ~${Math.round(((64 - PRIOR_ART_SIMILARITY_THRESHOLD) / 64) * 100)}% required).`,
    };
  }

  // Gate 6: timestamp precedence
  const genesisTs = genesis.createdAt ? new Date(genesis.createdAt) : null;
  const targetTs  = targetIdea.createdAt ? new Date(targetIdea.createdAt) : null;

  if (!genesisTs || !targetTs) return { success: false, error: "Unable to verify timestamps. Please try again." };
  if (genesisTs >= targetTs) return { success: false, error: "Your genesis timestamp does not predate the target idea." };

  // Gate 7: insert
  try {
    await db.insert(priorArtClaims).values({
      claimantId: userId,
      privateIdeaId,
      targetPublicIdeaId,
      genesisHash: genesis.hash,
      genesisTimestamp: genesisTs,
      similarityScore: distance,
      status: "open",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique_prior_art_claim") || msg.includes("duplicate")) {
      return { success: false, error: "You have already filed a claim against this idea." };
    }
    console.error("priorArtClaim insert failed:", err);
    return { success: false, error: "Failed to file claim. Please try again." };
  }

  if (targetIdea.userId) {
    await createNotification({
      userId: targetIdea.userId, type: "prior_art_claim",
      body: `A prior art claim has been filed against your idea "${targetIdea.title}". An admin will review it.`,
      link: `/idea/${targetPublicIdeaId}`,
    });
  }

  await awardXpForDomain(userId, 15, "private", "FILE_PRIOR_ART_CLAIM", privateIdeaId, true);

  revalidatePath(`/idea/${targetPublicIdeaId}`);
  revalidatePath(`/idea/${privateIdeaId}`);
  return { success: true, similarityScore: distance };
}

// ─── GET CLAIMS (public read) ─────────────────────────────────────────────────
export interface PriorArtClaimWithClaimant {
  id: string;
  claimantHandle: string | null;
  claimantTier: string | null;
  genesisTimestamp: Date | null;
  similarityScore: number | null;
  status: string;
  adminNote: string | null;
  createdAt: Date | null;
}

export async function getPriorArtClaims(targetIdeaId: string): Promise<PriorArtClaimWithClaimant[]> {
  const rows = await db
    .select({
      id: priorArtClaims.id,
      claimantHandle: users.handle,
      claimantTier: users.tier,
      genesisTimestamp: priorArtClaims.genesisTimestamp,
      similarityScore: priorArtClaims.similarityScore,
      status: priorArtClaims.status,
      adminNote: priorArtClaims.adminNote,
      createdAt: priorArtClaims.createdAt,
    })
    .from(priorArtClaims)
    .leftJoin(users, eq(priorArtClaims.claimantId, users.id))
    .where(eq(priorArtClaims.targetPublicIdeaId, targetIdeaId))
    .orderBy(priorArtClaims.createdAt);

  return rows as PriorArtClaimWithClaimant[];
}

// ─── RESOLVE CLAIM (admin) ────────────────────────────────────────────────────
export async function resolvePriorArtClaim(
  claimId: string,
  status: "reviewed" | "dismissed",
  adminNote?: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const [claim] = await db.select().from(priorArtClaims).where(eq(priorArtClaims.id, claimId));
  if (!claim) return { success: false, error: "Claim not found" };

  await db.update(priorArtClaims).set({ status, adminNote: adminNote ?? null }).where(eq(priorArtClaims.id, claimId));

  await createNotification({
    userId: claim.claimantId, type: "prior_art_resolved",
    body: status === "reviewed"
      ? "Your prior art claim has been reviewed and acknowledged."
      : "Your prior art claim was dismissed after review.",
    link: `/idea/${claim.targetPublicIdeaId}`,
  });

  revalidatePath("/admin/justice");
  revalidatePath(`/idea/${claim.targetPublicIdeaId}`);
  return { success: true };
}
