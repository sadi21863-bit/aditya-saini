/**
 * Single source of truth for idea categories.
 * Import this anywhere you need a category list:
 *   - Studio quick-tags
 *   - Edit page <select>
 *   - IdeaForm datalist
 *   - Feed filter display
 */
export const CATEGORIES = [
  "Tech",
  "Design",
  "Social",
  "Finance",
  "Creative",
  "General",
] as const;

export type Category = (typeof CATEGORIES)[number];
