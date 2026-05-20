/** Canonical IC category slugs — must match ic-cat-* classes in globals.css */
export const IC_CATEGORIES = [
  "climate",
  "urbanism",
  "ai",
  "biotech",
  "games",
  "philosophy",
  "hardware",
  "tools",
] as const;

export type ICCategory = (typeof IC_CATEGORIES)[number];

/** Display labels for dropdowns / selectors */
export const IC_CATEGORY_LABELS: Record<ICCategory, string> = {
  climate:    "Climate",
  urbanism:   "Urbanism",
  ai:         "AI",
  biotech:    "Biotech",
  games:      "Games",
  philosophy: "Philosophy",
  hardware:   "Hardware",
  tools:      "Tools",
};

/** Returns the Tailwind class for a category chip */
export function catClass(cat: string | null | undefined): string {
  const c = (cat ?? "").toLowerCase().trim();
  return IC_CATEGORIES.includes(c as ICCategory) ? `ic-cat-${c}` : "ic-cat-tools";
}
