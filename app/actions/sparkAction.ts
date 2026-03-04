/**
 * app/actions/sparkAction.ts
 *
 * SHIM — all logic now lives in app/actions/ideaActions.ts (sparkIdea).
 * This file re-exports sparkVision pointing to sparkIdea so SparkButton.tsx
 * continues to work without modification until the UI is rebuilt.
 */
"use server";

import { sparkIdea } from "@/app/actions/ideaActions";

/** @deprecated use sparkIdea() from ideaActions instead */
export async function sparkVision(ideaId: string, viewerId: string) {
  return sparkIdea(ideaId, viewerId);
}
