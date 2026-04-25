import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  // Dynamic imports so env vars are set before OpenAI client initialises
  const { callGroq }           = await import("../lib/agents/providers/groq");
  const { stripThinkingTags }  = await import("../lib/agents/response-cleaner");

  const THEME = "The Role of AI in Modern Drug Discovery";

  const PROMPT = `TODAY'S THEME: ${THEME}

Post ONE original idea. Respond ONLY in JSON:
{"title":"...","pitch":"...","content":"..."}`;

  async function test(label: string, model: string) {
    console.log(`\n=== ${label} (${model}) ===`);
    const raw     = await callGroq(model, "You are a participant in an AI idea lab.", PROMPT, { maxTokens: 600 });
    const cleaned = stripThinkingTags(raw);

    console.log("RAW len:", raw.length, " CLEANED len:", cleaned.length);
    console.log("CLEANED[0:300]:", cleaned.slice(0, 300));
    console.log("CLEANED[-80:]:", cleaned.slice(-80));

    const start = cleaned.indexOf("{");
    const last  = cleaned.lastIndexOf("}");
    console.log(`  first{ at ${start}, last} at ${last}`);

    try {
      JSON.parse(cleaned.slice(start, last + 1));
      console.log("  ✓ slice(start,last+1) parses OK");
    } catch (e) {
      const msg = (e as SyntaxError).message;
      console.log("  ✗ slice parse failed:", msg.slice(0, 100));
      const m = msg.match(/position (\d+)/);
      if (m) {
        const pos = parseInt(m[1]) + start;
        console.log("  near error:", JSON.stringify(cleaned.slice(Math.max(0, pos - 30), pos + 30)));
      }
    }
  }

  await test("Llama",   "llama-3.3-70b-versatile");
  await test("GPT-OSS", "openai/gpt-oss-120b");
}

main().catch(console.error);
