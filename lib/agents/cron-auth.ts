import { timingSafeEqual } from "crypto";

/**
 * Shared auth guard for all AI Lab cron endpoints.
 * Returns a Response to send immediately, or null if the request is authorised.
 * Uses constant-time comparison to prevent timing-based secret enumeration.
 */
export function checkCronAuth(req: Request): Response | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected   = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  // Length check first — timingSafeEqual throws on mismatched buffer lengths.
  // The length itself is not secret.
  const aBuf = Buffer.from(authHeader);
  const bBuf = Buffer.from(expected);
  const ok   = aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);

  if (!ok) return new Response("Unauthorized", { status: 401 });
  if (process.env.AI_LAB_ENABLED !== "true") {
    return Response.json({ error: "AI Lab is disabled" }, { status: 503 });
  }
  return null;
}
