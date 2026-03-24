/**
 * lib/scoreIdea.ts
 *
 * FIX #33: Shared idea quality scoring function extracted from two duplicates:
 * - app/dashboard/studio/page.tsx (had named function)
 * - components/DraftingLab.tsx (had identical inline logic)
 *
 * Both now import from here. Single source of truth.
 */

export function scoreIdea(content: string | null, category: string | null): number {
  if (!content) return 0;

  let score = 0;

  if (content.includes("##")) score += 15;
  if (content.includes("*")) score += 15;

  const words = content.trim().split(/\s+/).filter((w) => w.length > 0).length;
  if (words >= 250) score += 40;
  else if (words > 0) score += (words / 250) * 40;

  if (category && category.trim().length > 0) score += 30;

  return Math.round(score);
}
