// Strip reasoning/thinking tags from model output before storage.
// Qwen3 and DeepSeek R1 Distill both emit <think>...</think> blocks in their
// default "thinking" mode. The content is chain-of-thought scratch work, not
// user-facing output. We drop it silently.
export function stripThinkingTags(text: string): string {
  // Match <think>, <thinking>, or <reasoning> blocks, case-insensitive,
  // including multiline content. Handle both closed and unclosed tags.
  const cleaned = text
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/gi, "") // unclosed tag at end
    .trim();
  return cleaned;
}
