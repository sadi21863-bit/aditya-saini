/**
 * lib/justice-engine.ts — v13
 *
 * Domain-aware justice engine.
 *
 * Private domain:
 *   - 4 report types: plagiarism, vulgar_inappropriate, political, opinion_not_idea
 *   - Includes hash scan for duplicate detection
 *
 * Public domain:
 *   - 3 report types: vulgar_inappropriate, political, opinion_not_idea
 *   - Plagiarism reports rejected at API level (400) before reaching this engine
 *
 * Rule-based scoring — no Groq dependency unless explicitly confirmed operational.
 */

import { createHash } from "crypto";
import type { AuditStatus, AuditMetadata } from "@/lib/justice-types";

interface JusticeInput {
  id: string;
  title: string;
  content: string | null;
  genesisHash: string | null;
  domain: string; // 'private' | 'public'
}

interface JusticeResult {
  riskScore: number;
  status: AuditStatus;
  metadata: AuditMetadata;
}

/**
 * Run a justice audit on an idea.
 * Returns a deterministic risk score and status.
 * Score is hash-derived — same content always gets the same score.
 */
export function runJusticeAudit(idea: JusticeInput): JusticeResult {
  const hash = createHash("sha256")
    .update((idea.content ?? "") + (idea.title ?? ""))
    .digest("hex");

  const riskScore = parseInt(hash.slice(0, 4), 16) % 100;
  const status: AuditStatus = riskScore > 75 ? "flagged" : "verified";

  const metadata: AuditMetadata = {
    scanned: true,
    riskScore,
    lastAudit: new Date().toISOString(),
    status,
    scanVersion: "v13.0-rule-based",
    isMockScore: true, // Replace with false when real scoring is implemented
  };

  return { riskScore, status, metadata };
}

/**
 * Run a hash scan for duplicate private ideas.
 * Returns true if the genesisHash matches another published private idea.
 * This check runs only for private domain ideas.
 */
export async function runHashScan(
  ideaId: string,
  genesisHash: string | null,
  db: import("@/db").Db
): Promise<boolean> {
  if (!genesisHash) return false;

  const { ideas } = await import("@/db/schema");
  const { eq, and, ne } = await import("drizzle-orm");

  const duplicates = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(
      and(
        eq(ideas.genesisHash, genesisHash),
        ne(ideas.id, ideaId),
        eq(ideas.status, "published"),
        eq(ideas.domain, "private")
      )
    )
    .limit(1);

  return duplicates.length > 0;
}

/**
 * Validate a report type for a given domain.
 * Public domain: plagiarism reports are not allowed.
 */
export function isValidReportType(reportType: string, domain: string): boolean {
  if (domain === "public" && reportType === "plagiarism") {
    return false;
  }
  const valid = [
    "plagiarism",
    "vulgar_inappropriate",
    "political",
    "opinion_not_idea",
  ];
  return valid.includes(reportType);
}
