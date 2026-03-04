/**
 * lib/auth.ts - Hybrid Development Mode
 * 
 * Placeholder authentication for Phase 2-4 testing.
 * Switch to Clerk when ready for production.
 */

// import { auth } from "@clerk/nextjs/server"; // ← Disabled for dev

export async function getAuthenticatedUserId(): Promise<string> {
  // ── Development Placeholder ─────────────────────────────────────────────
  // This allows Phase 2-4 (Genesis Hash, Justice Engine, Similarity Check)
  // to work without Clerk keys. Always returns the same test user ID.
  return "user_test_123";

  /* ── Production: Clerk (Enable this when ready) ─────────────────────────
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  return userId;
  */
}
