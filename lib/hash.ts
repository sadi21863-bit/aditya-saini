/**
 * lib/hash.ts
 *
 * Cryptographic hashing utilities using Web Crypto API.
 * Used for Genesis Hash generation and immutable ownership proofs.
 *
 * v11-justice Phase 5: SimHash now uses real Charikar algorithm (lib/simhash.ts)
 * for fuzzy near-duplicate detection. GenesisHash is unchanged (SHA-256).
 */

import {
    computeSimHash,
    computeCombinedSimHash as _combinedSimHash,
    isNearDuplicate,
} from "@/lib/simhash";

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256  (used only for GenesisHash — immutable ownership proof)
// ─────────────────────────────────────────────────────────────────────────────
export async function sha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// GENESIS HASH  (SHA-256, never changes — immutable authorship anchor)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateGenesisHash(
    title: string,
    content: string,
    userId: string,
    timestamp: Date
): Promise<string> {
    const seed = `${title}${content}${userId}${timestamp.toISOString()}`;
    return sha256(seed);
}

// ─────────────────────────────────────────────────────────────────────────────
// SIM HASH  (Charikar — fuzzy fingerprint for plagiarism detection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate SimHash from content only.
 * Returns a decimal string (not hex) — Hamming-distance comparable.
 */
export async function generateSimHash(content: string): Promise<string> {
    return computeSimHash(content);
}

/**
 * Generate SimHash from title + content.
 * Title is weighted 3× for more accurate duplicate detection.
 */
export async function generateCombinedSimHash(
    title: string,
    content: string
): Promise<string> {
    return _combinedSimHash(title, content);
}

/**
 * Check if two SimHashes represent near-duplicate content.
 * Uses Hamming distance (≤ 3 = duplicate), NOT exact match.
 */
export function areSimilar(hash1: string, hash2: string): boolean {
    return isNearDuplicate(hash1, hash2);
}
