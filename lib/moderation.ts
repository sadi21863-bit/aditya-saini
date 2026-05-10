const BLOCKED_TERMS: string[] = [
  // Add real terms here as needed — case-insensitive match
  "spam_example",
];

export function containsBlockedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_TERMS.some((term) => lower.includes(term));
}
