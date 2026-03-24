/**
 * lib/simhash.ts — v11-justice Phase 5 (BigInt upgrade)
 *
 * Real Charikar SimHash for near-duplicate detection using 64-bit FNV-1a.
 *
 * FIX #17: computeSimHash now THROWS on empty/whitespace-only content instead of
 * returning "0". Previously both hashes would be "0" and isNearDuplicate would
 * return false — allowing any two minimal-content ideas to bypass duplicate detection.
 *
 * launchIdea() catches this throw and returns { success: false, error: "Content too short..." }
 */

const FNV64_PRIME = BigInt("0x00000100000001B3");
const FNV64_OFFSET = BigInt("0xcbf29ce484222325");
const MASK64 = BigInt("0xFFFFFFFFFFFFFFFF");

function fnv64(str: string): bigint {
  let hash = FNV64_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * FNV64_PRIME) & MASK64;
  }
  return hash;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Compute 64-bit SimHash as a hex string from text tokens.
 *
 * FIX #17: Throws instead of returning "0" for empty content.
 * Callers (launchIdea) must catch and handle gracefully.
 */
export function computeSimHash(text: string): string {
  const tokens = tokenize(text);

  // FIX #17: Throw rather than return sentinel "0" — callers must catch
  if (tokens.length === 0) {
    throw new Error("Content too short for similarity check");
  }

  const bits = new Array(64).fill(0);

  for (const token of tokens) {
    const h = fnv64(token);
    for (let i = 0; i < 64; i++) {
      bits[i] += (h >> BigInt(i)) & BigInt(1) ? 1 : -1;
    }
  }

  let hash = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (bits[i] > 0) hash |= BigInt(1) << BigInt(i);
  }

  return hash.toString(16);
}

/**
 * Hamming distance between two SimHash hex strings.
 */
export function hammingDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let dist = 0;
  while (x > BigInt(0)) {
    dist += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return dist;
}

/**
 * Returns true if two SimHash strings represent near-duplicate content.
 * Threshold: Hamming distance ≤ 3 (tunable)
 *
 * FIX #17: Guard removed for "0" — computeSimHash no longer returns "0",
 * so the only falsy case is empty/null strings (genuine missing data).
 */
export function isNearDuplicate(a: string, b: string, threshold = 3): boolean {
  if (!a || !b) return false;
  try {
    return hammingDistance(a, b) <= threshold;
  } catch {
    return false;
  }
}

/**
 * Combined SimHash from title + content (weighted: title counts 3×)
 */
export function computeCombinedSimHash(title: string, content: string): string {
  const weighted = `${title} ${title} ${title} ${content}`;
  return computeSimHash(weighted);
}
