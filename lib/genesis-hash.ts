/**
 * lib/genesis-hash.ts — v13
 *
 * Cryptographic hash utilities for the Genesis Hash pipeline.
 * SHA-256 is used for immutable ownership proofs (unchanged from v12).
 * SimHash is used for near-duplicate detection.
 */

import {
  computeSimHash,
  computeCombinedSimHash as _combinedSimHash,
  isNearDuplicate,
} from "@/lib/simhash";

// ─── SHA-256 ─────────────────────────────────────────────────────────────────

export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a Genesis Hash for a private idea.
 * Inputs: title + content + userId + timestamp ISO string.
 * The hash is deterministic — same inputs always produce the same hash.
 * Never re-generated after first publish (immutable ownership anchor).
 */
export async function generateGenesisHash(
  title: string,
  content: string,
  userId: string,
  timestamp: Date
): Promise<string> {
  const seed = `${title}${content}${userId}${timestamp.toISOString()}`;
  return sha256(seed);
}

// ─── SimHash (fuzzy near-duplicate detection) ─────────────────────────────────

export async function generateSimHash(content: string): Promise<string> {
  return computeSimHash(content);
}

export async function generateCombinedSimHash(
  title: string,
  content: string
): Promise<string> {
  return _combinedSimHash(title, content);
}

export function areSimilar(hash1: string, hash2: string): boolean {
  return isNearDuplicate(hash1, hash2);
}
