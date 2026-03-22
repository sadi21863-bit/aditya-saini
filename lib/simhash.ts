/**
 * lib/simhash.ts — v11-justice Phase 5 (BigInt upgrade)
 *
 * Real Charikar SimHash for near-duplicate detection using 64-bit FNV-1a.
 * Unlike SHA-256 (exact only), SimHash produces similar hashes for similar
 * content — allowing fuzzy matching via Hamming distance.
 *
 * Hamming distance ≤ 3 = near-duplicate (configurable)
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
 * Returns a hex string for DB storage (text column).
 */
export function computeSimHash(text: string): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) return "0";

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
 * Lower = more similar. Distance ≤ 3 = near-duplicate.
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
 */
export function isNearDuplicate(a: string, b: string, threshold = 3): boolean {
  if (!a || !b || a === "0" || b === "0") return false;
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
