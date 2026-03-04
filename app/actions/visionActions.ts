"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { revalidatePath } from "next/cache";

/**
 * app/actions/visionActions.ts
 *
 * Used by DraftingLab.tsx to save a quick draft.
 *
 * IMPORTANT: genesisHash is NOT set here.
 * It is generated exclusively in launchIdea() (ideaActions.ts) on the
 * first draft→public transition. Generating a hash at save-time would
 * use mutable content as the seed, making it meaningless as a
 * first-publication timestamp proof.
 *
 * The old `genesisCode` column no longer exists — the schema uses `genesisHash`.
 */
export async function saveToHangar(formData: {
  title:    string;
  hook:     string;
  content:  string;
  category: string;
  userId:   string;
}) {
  try {
    await db.insert(ideas).values({
      title:      formData.title,
      hook:       formData.hook,
      content:    formData.content,
      category:   formData.category,
      userId:     formData.userId,
      status:     "draft",
      totalLikes: 0,
      views:      0,
      blurLevel:  0,
      // genesisHash intentionally omitted — set only at launch time
    });

    revalidatePath("/dashboard");

    // Return success without genesisCode (it no longer exists at this stage).
    // DraftingLab shows a truncated success message from this return value.
    return { success: true, genesisCode: null };
  } catch (error) {
    console.error("saveToHangar failed:", error);
    return { success: false, error: "Database rejected the idea." };
  }
}
