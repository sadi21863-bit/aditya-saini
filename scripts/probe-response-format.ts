/**
 * Probe whether Groq supports response_format: { type: "json_object" }
 * for our three Groq models. Reports: supported / unsupported / error.
 *
 * Run: npx tsx scripts/probe-response-format.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

async function probe() {
  const OpenAI = (await import("openai")).default;
  const groq = new OpenAI({
    apiKey:  process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const MODELS = [
    { name: "qwen/qwen3-32b",          label: "Theme Setter / Quality Checker (admin)" },
    { name: "llama-3.3-70b-versatile", label: "Llama (participant)" },
    { name: "openai/gpt-oss-120b",     label: "GPT-OSS (participant)" },
  ];

  const SYS  = "You output only JSON.";
  const USER = 'Respond with { "ok": true }';

  for (const { name, label } of MODELS) {
    process.stdout.write(`\n${label} (${name})\n  without response_format ... `);

    // --- baseline (no response_format) ---
    try {
      const r = await groq.chat.completions.create({
        model: name, messages: [{ role: "system", content: SYS }, { role: "user", content: USER }],
        max_tokens: 30, temperature: 0,
      });
      const text = r.choices[0]?.message?.content ?? "";
      process.stdout.write(`OK (${text.trim().slice(0, 40)})\n`);
    } catch (e) {
      process.stdout.write(`ERROR: ${(e as Error).message.slice(0, 80)}\n`);
    }

    // --- with response_format ---
    process.stdout.write(`  with    response_format ... `);
    try {
      const r = await groq.chat.completions.create({
        model: name,
        messages: [{ role: "system", content: SYS }, { role: "user", content: USER }],
        max_tokens: 30,
        temperature: 0,
        // @ts-ignore — may not be in types for all SDK versions
        response_format: { type: "json_object" },
      });
      const text = r.choices[0]?.message?.content ?? "";
      process.stdout.write(`SUPPORTED ✓  (${text.trim().slice(0, 40)})\n`);
    } catch (e) {
      const msg = (e as Error).message;
      const supported = !msg.toLowerCase().includes("not support") &&
                        !msg.toLowerCase().includes("unsupported") &&
                        !msg.toLowerCase().includes("invalid");
      if (supported) {
        process.stdout.write(`UNKNOWN ERROR: ${msg.slice(0, 80)}\n`);
      } else {
        process.stdout.write(`NOT SUPPORTED — ${msg.slice(0, 80)}\n`);
      }
    }
  }

  console.log("\nDone.");
}

probe().catch(console.error);
