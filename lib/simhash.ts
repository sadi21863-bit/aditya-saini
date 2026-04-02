/**
 * lib/simhash.ts — v14
 * 64-bit Charikar SimHash via FNV-1a for near-duplicate detection.
 * FIX: computeSimHash throws on empty content (was silently returning "0")
 */

const FNV64_PRIME  = BigInt("0x00000100000001B3");
const FNV64_OFFSET = BigInt("0xcbf29ce484222325");
const MASK64       = BigInt("0xFFFFFFFFFFFFFFFF");

function fnv64(str: string): bigint {
  let hash = FNV64_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash  = (hash * FNV64_PRIME) & MASK64;
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

/** Throws on empty/whitespace-only content instead of returning "0". */
export function computeSimHash(text: string): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) throw new Error("Content too short for similarity check");

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

export function hammingDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let dist = 0;
  while (x > BigInt(0)) { dist += Number(x & BigInt(1)); x >>= BigInt(1); }
  return dist;
}

export function isNearDuplicate(a: string, b: string, threshold = 3): boolean {
  if (!a || !b) return false;
  try { return hammingDistance(a, b) <= threshold; } catch { return false; }
}

export function computeCombinedSimHash(title: string, content: string): string {
  return computeSimHash(`${title} ${title} ${title} ${content}`);
}

/** Hamming distance <= this value = prior art similarity gate passes. */
export const PRIOR_ART_SIMILARITY_THRESHOLD = 18;
