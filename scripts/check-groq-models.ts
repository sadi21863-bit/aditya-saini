import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const r = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  });
  const j = await r.json();
  const ids: string[] = (j.data ?? []).map((m: any) => m.id).sort();
  console.log(`total models: ${ids.length}`);
  for (const id of ids) console.log(" ", id);

  console.log("\n--- checks ---");
  console.log(`llama-3.3-70b-versatile present: ${ids.includes("llama-3.3-70b-versatile")}`);
  console.log(`openai/gpt-oss-120b present: ${ids.includes("openai/gpt-oss-120b")}`);
  console.log(`openai/gpt-oss-20b present: ${ids.includes("openai/gpt-oss-20b")}`);
  const llamaLike = ids.filter((id) => id.includes("llama"));
  console.log("llama-family models:", llamaLike.join(", ") || "(none)");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
