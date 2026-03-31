/**
 * lib/open-timestamps.ts — v13
 *
 * OpenTimestamps integration via raw HTTP (no npm package).
 * Posts a SHA-256 digest to the OTS calendar and stores the binary proof in Vercel Blob.
 *
 * Flow:
 *   1. submitDigest(hash) → returns binary .ots proof bytes
 *   2. uploadProofToBlob(ideaId, proofBytes) → returns Vercel Blob URL
 *   3. checkConfirmation(otsBlobUrl) → returns boolean (Bitcoin anchored?)
 *
 * Environment variables required:
 *   OTS_CALENDAR_URL=https://alice.btc.calendar.opentimestamps.org/digest
 *   BLOB_READ_WRITE_TOKEN (Vercel Blob)
 */

const OTS_CALENDAR_URL =
  process.env.OTS_CALENDAR_URL ??
  "https://alice.btc.calendar.opentimestamps.org/digest";

/**
 * Submit a hex digest to the OTS calendar.
 * Returns the raw binary proof (.ots file content) as a Buffer.
 * Throws on non-200 responses.
 */
export async function submitDigest(hexHash: string): Promise<Buffer> {
  // OTS expects the raw 32-byte digest as binary, not hex
  const bytes = Buffer.from(hexHash, "hex");

  const res = await fetch(OTS_CALENDAR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OTS calendar returned ${res.status}: ${text.slice(0, 200)}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload the .ots proof bytes to Vercel Blob.
 * Returns the public blob URL.
 * Requires: BLOB_READ_WRITE_TOKEN env var.
 */
export async function uploadProofToBlob(
  ideaId: string,
  proofBytes: Buffer
): Promise<string> {
  const { put } = await import("@vercel/blob");

  const blob = await put(`ots/${ideaId}.ots`, proofBytes, {
    access: "public",
    contentType: "application/octet-stream",
  });

  return blob.url;
}

/**
 * Check if an OTS proof has been Bitcoin-confirmed.
 * Fetches the .ots file from Vercel Blob and inspects for confirmation markers.
 *
 * OTS .ots files contain a "bitcoin" attestation once anchored.
 * We check for the 8-byte Bitcoin attestation tag: 0x0588960d73d71916
 */
export async function checkConfirmation(otsBlobUrl: string): Promise<boolean> {
  try {
    const res = await fetch(otsBlobUrl);
    if (!res.ok) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    // Bitcoin attestation magic bytes
    const bitcoinTag = Buffer.from("0588960d73d71916", "hex");

    for (let i = 0; i <= buffer.length - bitcoinTag.length; i++) {
      if (buffer.slice(i, i + bitcoinTag.length).equals(bitcoinTag)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
