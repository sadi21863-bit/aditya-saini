/**
 * lib/hash.ts
 * 
 * Cryptographic hashing utilities using Web Crypto API.
 * Used for Genesis Hash generation and immutable ownership proofs.
 */

/**
 * Generate SHA-256 hash of input string
 * @param input - String to hash
 * @returns Hexadecimal hash string
 */
export async function sha256(input: string): Promise<string> {
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

    return hashHex;
}

/**
 * Generate Genesis Hash for an idea
 * Seed: title + content + userId + ISO timestamp
 * This creates an immutable proof of original authorship
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

/**
 * Normalize text for similarity comparison
 * Removes spaces, punctuation, and converts to lowercase
 * This creates a "content fingerprint" for plagiarism detection
 */
function normalizeForSimilarity(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric chars
        .trim();
}

/**
 * Generate Similarity Hash (SimHash)
 * A "fuzzy" content fingerprint for detecting near-duplicate ideas
 * 
 * Phase 4: Uses normalized text + SHA-256
 * Future: Can be upgraded to MinHash, LSH, or embedding-based similarity
 * 
 * @param content - The idea content to fingerprint
 * @returns SimHash string
 */
export async function generateSimHash(content: string): Promise<string> {
    // Normalize: lowercase, remove spaces/punctuation
    const normalized = normalizeForSimilarity(content);

    // Hash the normalized content
    return sha256(normalized);
}

/**
 * Generate Similarity Hash from Title + Content
 * Combines both fields for more accurate duplicate detection
 * 
 * @param title - Idea title
 * @param content - Idea content
 * @returns Combined SimHash
 */
export async function generateCombinedSimHash(
    title: string,
    content: string
): Promise<string> {
    // Combine title and content for comprehensive similarity check
    const combined = `${title}${content}`;
    return generateSimHash(combined);
}

/**
 * Check if two simHashes are similar (potential duplicate)
 * Currently uses exact match, but can be upgraded to fuzzy matching
 * 
 * @param hash1 - First hash to compare
 * @param hash2 - Second hash to compare
 * @returns Boolean indicating if hashes match
 */
export function areSimilar(hash1: string, hash2: string): boolean {
    return hash1 === hash2;
}
