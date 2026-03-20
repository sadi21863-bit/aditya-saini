/**
 * lib/simhash.ts — v11-justice Phase 5
 * 
 * Real Charikar SimHash for near-duplicate detection.
 * Unlike SHA-256 (exact only), SimHash produces similar hashes
 * for similar content — allowing fuzzy matching via Hamming distance.
 * 
 * Hamming distance ≤ 3 = near-duplicate (configurable)
 */

// ── Simple 64-bit SimHash using 32-bit JS integers (high + low) ──────────────

function fnv32(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash;
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2); // skip stop words < 3 chars
}

/**
 * Compute SimHash as a 32-bit integer from text tokens.
 * Returns a decimal string for DB storage.
 */
export function computeSimHash(text: string): string {
    const tokens = tokenize(text);
    if (tokens.length === 0) return "0";

    const bits = new Array(32).fill(0);

    for (const token of tokens) {
        const h = fnv32(token);
        for (let i = 0; i < 32; i++) {
            bits[i] += (h >> i) & 1 ? 1 : -1;
        }
    }

    let hash = 0;
    for (let i = 0; i < 32; i++) {
        if (bits[i] > 0) hash |= 1 << i;
    }

    // Return as unsigned 32-bit decimal string
    return (hash >>> 0).toString();
}

/**
 * Hamming distance between two SimHash strings.
 * Lower = more similar. Distance ≤ 3 = near-duplicate.
 */
export function hammingDistance(a: string, b: string): number {
    const x = parseInt(a) ^ parseInt(b);
    let dist = 0;
    let n = x >>> 0;
    while (n) {
        dist += n & 1;
        n >>>= 1;
    }
    return dist;
}

/**
 * Returns true if two SimHash strings represent near-duplicate content.
 * Threshold: Hamming distance ≤ 3 (tunable)
 */
export function isNearDuplicate(a: string, b: string, threshold = 3): boolean {
    if (!a || !b || a === "0" || b === "0") return false;
    return hammingDistance(a, b) <= threshold;
}

/**
 * Combined SimHash from title + content (weighted: title counts 3×)
 */
export function computeCombinedSimHash(title: string, content: string): string {
    // Weight title more heavily by repeating it
    const weighted = `${title} ${title} ${title} ${content}`;
    return computeSimHash(weighted);
}
