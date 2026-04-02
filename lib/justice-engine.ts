import type { db as DbType } from "@/db";
import { ideas, genesisHashes } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

export type AuditStatus = "verified" | "flagged" | "pending";

interface AuditResult {
  riskScore: number;
  status: AuditStatus;
  metadata: Record<string, unknown>;
}

/** Heuristic content-quality audit. Returns a risk score 0-100. */
export function runJusticeAudit(idea: {
  id: string;
  title: string;
  content: string | null;
  genesisHash: string | null;
  aiMetadata: unknown;
  userId: string | null;
  domain: string;
}): AuditResult {
  let riskScore = 0;
  const flags: string[] = [];

  // Short content
  const wordCount = (idea.content ?? "").split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) { riskScore += 30; flags.push("content_too_short"); }
  else if (wordCount < 50) { riskScore += 10; flags.push("content_sparse"); }

  // No title
  if (!idea.title || idea.title.trim().length < 3) { riskScore += 20; flags.push("missing_title"); }

  // Placeholder / deleted content
  if (idea.title === "[deleted]" || idea.title === "[removed by moderator]") {
    riskScore += 50; flags.push("tombstoned");
  }

  // Private idea with no genesis hash
  if (idea.domain === "private" && !idea.genesisHash) { riskScore += 15; flags.push("no_genesis_hash"); }

  // Clamp to 100
  riskScore = Math.min(100, riskScore);

  const isMockScore = false;
  const status: AuditStatus = riskScore >= 50 ? "flagged" : "verified";

  return {
    riskScore,
    status,
    metadata: {
      riskScore,
      flags,
      scanned: true,
      status,
      isMockScore,
      wordCount,
      scannedAt: new Date().toISOString(),
    },
  };
}

/** Checks if another published idea already has the same genesis hash. */
export async function runHashScan(
  ideaId: string,
  genesisHash: string,
  db: typeof DbType
): Promise<boolean> {
  const duplicates = await db
    .select({ id: genesisHashes.id })
    .from(genesisHashes)
    .where(
      and(
        eq(genesisHashes.hash, genesisHash),
        ne(genesisHashes.ideaId, ideaId)
      )
    )
    .limit(1);

  return duplicates.length > 0;
}
