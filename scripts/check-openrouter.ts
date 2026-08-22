import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

interface ORModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture?: { modality?: string; input_modalities?: string[] };
}

async function main() {
  const r = await fetch("https://openrouter.ai/api/v1/models");
  if (!r.ok) throw new Error(`models list failed: ${r.status}`);
  const j = await r.json();
  const all: ORModel[] = j.data ?? [];
  console.log(`total models on OpenRouter: ${all.length}`);

  const free = all
    .filter((m) => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
    .sort((a, b) => b.context_length - a.context_length);

  console.log(`\n=== always-free models (prompt=0 AND completion=0): ${free.length} ===`);
  for (const m of free) {
    console.log(`  ${m.id.padEnd(55)} ctx=${String(m.context_length).padStart(8)}`);
  }

  // Key validation + tiny live call against the top free model
  const key = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY;
  console.log(`\nkey present: ${!!key}`);
  if (!key || free.length === 0) return;

  const target = free.find((m) => m.id.includes("deepseek"))
    ?? free.find((m) => m.context_length >= 64000)
    ?? free[0];
  console.log(`\ntest call -> ${target.id}`);
  const t0 = Date.now();
  const cr = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: target.id,
      messages: [
        { role: "system", content: "Respond with JSON only." },
        { role: "user", content: 'Return exactly this JSON: {"ok":true}' },
      ],
      max_tokens: 100,
      temperature: 0,
    }),
  });
  const body = await cr.text();
  console.log(`status: ${cr.status} in ${Date.now() - t0}ms`);
  console.log(`body: ${body.slice(0, 400)}`);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
process.on("exit", () => process.exit(0));
