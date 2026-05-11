import { getParticipants } from "./personas";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface MentionResult {
  agentId: string;
  agentHandle: string;
  isRandomSelection: boolean;
}

// "research" is intentionally excluded — @research is only invoked by AI agents, not humans.
// "scout" replaces "qwen" — ai_qwen renamed to ai_scout on 2026-05-11.
const SPECIFIC_HANDLES = ["llama", "gpt-oss", "scout"];
const RANDOM_TOKENS = ["ai", "random"];

/**
 * Parse mentions from comment text. Returns a list of resolved agent IDs
 * (specific agents for @llama, resolved-at-random for @ai).
 *
 * Regex requires a word boundary BEFORE the @ (via (?:^|\s)) to avoid
 * matching email addresses like "hi@llama.dev" as an @llama mention.
 */
export async function extractAIMentions(text: string): Promise<MentionResult[]> {
  const results: MentionResult[] = [];
  const seen = new Set<string>();

  // 1. Specific mentions — (^|\s) before @ ensures email addresses don't match
  for (const handle of SPECIFIC_HANDLES) {
    const re = new RegExp(`(?:^|\\s)@${handle}\\b`, "i");
    if (re.test(text)) {
      const agent = getParticipants().find((a) => a.handle === handle);
      if (agent && !seen.has(agent.id)) {
        results.push({ agentId: agent.id, agentHandle: agent.handle, isRandomSelection: false });
        seen.add(agent.id);
      }
    }
  }

  // 2. Random mentions — pick one NOT-rate-limited participant per @ai token
  const randomMentionCount = RANDOM_TOKENS.reduce((count, token) => {
    const matches = text.match(new RegExp(`(?:^|\\s)@${token}\\b`, "gi")) ?? [];
    return count + matches.length;
  }, 0);

  if (randomMentionCount > 0) {
    const available = await getAvailableParticipants();
    for (let i = 0; i < Math.min(randomMentionCount, 1); i++) {
      // Cap @ai resolutions at 1 per comment — can't stack
      const pool = available.filter((a) => !seen.has(a.id));
      if (pool.length === 0) break;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      results.push({ agentId: picked.id, agentHandle: picked.handle, isRandomSelection: true });
      seen.add(picked.id);
    }
  }

  return results;
}

/** Returns participants that are not at their daily limit today. */
async function getAvailableParticipants() {
  const today = new Date().toISOString().slice(0, 10);
  const participants = getParticipants();
  const usage = await db.select().from(aiUsage).where(eq(aiUsage.date, today));
  const usageMap = new Map(usage.map((u) => [u.agentId, u.requestCount]));

  return participants.filter((a) => {
    const used = usageMap.get(a.id) ?? 0;
    return used < a.dailyLimit;
  });
}
