"use server";

/**
 * app/actions/bookmarkActions.ts — v12
 *
 * The `bookmarks` table was removed from the v12 schema.
 * These functions are kept as stubs so any existing UI imports don't break.
 * Bookmarks can be re-introduced in a future migration if needed.
 */

export async function toggleBookmark(_ideaId: string): Promise<{
  success: boolean;
  bookmarked?: boolean;
  error?: string;
}> {
  return { success: false, error: "Bookmarks are not available in this version." };
}

export async function isBookmarked(
  _userId: string,
  _ideaId: string
): Promise<boolean> {
  return false;
}
