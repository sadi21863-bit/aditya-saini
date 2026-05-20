/** Returns midnight (00:00:00.000) of the current local day. */
export function startOfToday(): Date {
  return new Date(new Date().setHours(0, 0, 0, 0));
}

export function relativeTime(date: Date | null | undefined): string {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 5)      return "just now";
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
