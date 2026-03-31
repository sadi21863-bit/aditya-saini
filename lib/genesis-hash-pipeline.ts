/**
 * lib/genesis-hash-pipeline.ts — v13
 * Called from launchIdea when a private idea is published.
 * Persists the genesis hash to the genesisHashes table and kicks off OTS.
 * Failures are non-blocking — idea publish succeeds regardless.
 */
import { db } from "@/db";
import { genesisHashes } from "@/db/schema";

export async function initiateGenesisHash(ideaId: string, hash: string): Promise<void> {
  // Insert the hash record (skip if already exists from a re-launch)
  await db
    .insert(genesisHashes)
    .values({ ideaId, hash, confirmed: false })
    .onConflictDoNothing();

  // Kick off OTS submission via API route (fire and forget)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  fetch(`${baseUrl}/api/genesis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ideaId }),
  }).catch(() => { /* non-blocking */ });
}
