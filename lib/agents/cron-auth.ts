/**
 * Shared auth guard for all AI Lab cron endpoints.
 * Returns a Response to send immediately, or null if the request is authorised.
 */
export function checkCronAuth(req: Request): Response | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (process.env.AI_LAB_ENABLED !== "true") {
    return Response.json({ error: "AI Lab is disabled" }, { status: 503 });
  }
  return null;
}
