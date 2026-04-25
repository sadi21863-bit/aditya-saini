/**
 * scripts/seed-ai-agents.ts
 *
 * Inserts 6 AI agent users, creates the AI Lab room, and adds 5 room members.
 * Writes AI_LAB_ROOM_ID to .env.local on completion.
 *
 * Run with:  npx tsx scripts/seed-ai-agents.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env first (DATABASE_URL), then .env.local (API keys, overrides)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, rooms, roomMembers } from "../db/schema";
import { ALL_AGENTS, getParticipants, getAdmins } from "../lib/agents/personas";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(client);

async function seed() {
  console.log("=== AI Lab Seed Script ===\n");

  // ─── 1. Upsert AI agent users ────────────────────────────────────────
  console.log("Step 1: Inserting AI agent users...");

  for (const agent of ALL_AGENTS) {
    await db
      .insert(users)
      .values({
        id:          agent.id,
        name:        agent.name,
        handle:      agent.handle,
        email:       `${agent.handle}@ai.ideaconnect.internal`,
        image:       agent.avatar,
        avatarUrl:   agent.avatar,
        isAi:        true,
        aiProvider:  agent.provider,
        aiModel:     agent.model,
        aiRole:      agent.role,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name:       agent.name,
          aiProvider: agent.provider,
          aiModel:    agent.model,
          aiRole:     agent.role,
          image:      agent.avatar,
          avatarUrl:  agent.avatar,
        },
      });
    console.log(`  ✓ ${agent.name} (${agent.id}) — ${agent.provider}/${agent.model}`);
  }

  // ─── 2. Create the AI Lab room ───────────────────────────────────────
  console.log("\nStep 2: Creating AI Lab room...");

  // Use the first admin agent as the room creator
  const creatorAgent = ALL_AGENTS.find((a) => a.role === "theme_setter")!;

  // Check if AI Lab room already exists
  const existing = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.isAiLab, true))
    .limit(1);

  let labRoomId: string;

  if (existing.length > 0) {
    labRoomId = existing[0].id;
    console.log(`  (AI Lab room already exists: ${labRoomId})`);
  } else {
    const [newRoom] = await db
      .insert(rooms)
      .values({
        name:        "AI Lab",
        description: "Watch AI models explore ideas together. Read-only for humans — @mention agents from your own rooms to invite their input.",
        category:    "ai-lab",
        creatorId:   creatorAgent.id,
        visibility:  "public",
        maxMembers:  20,
        status:      "active",
        isAiLab:     true,
      })
      .returning({ id: rooms.id });
    labRoomId = newRoom.id;
    console.log(`  ✓ AI Lab room created: ${labRoomId}`);
  }

  // ─── 3. Add 5 room members ───────────────────────────────────────────
  // Theme Setter, Quality Checker, Llama, GPT-OSS, Qwen
  // Archivist is NOT a member — works in background
  console.log("\nStep 3: Adding room members...");

  const admins     = getAdmins();
  const participants = getParticipants();
  const memberAgents = [...admins, ...participants];

  for (const agent of memberAgents) {
    await db
      .insert(roomMembers)
      .values({
        roomId:  labRoomId,
        userId:  agent.id,
        role:    agent.role === "theme_setter" ? "owner" : "member",
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${agent.name} added as ${agent.role === "theme_setter" ? "owner" : "member"}`);
  }

  // ─── 4. Write AI_LAB_ROOM_ID to .env.local ───────────────────────────
  console.log("\nStep 4: Writing AI_LAB_ROOM_ID to .env.local...");

  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  let envContent = fs.existsSync(envLocalPath)
    ? fs.readFileSync(envLocalPath, "utf-8")
    : "";

  if (envContent.includes("AI_LAB_ROOM_ID=")) {
    // Replace existing value (commented or otherwise)
    envContent = envContent.replace(
      /^#?\s*AI_LAB_ROOM_ID=.*$/m,
      `AI_LAB_ROOM_ID=${labRoomId}`
    );
  } else {
    envContent += `\nAI_LAB_ROOM_ID=${labRoomId}\n`;
  }

  fs.writeFileSync(envLocalPath, envContent);
  console.log(`  ✓ AI_LAB_ROOM_ID=${labRoomId} written to .env.local`);

  // ─── 5. Summary ─────────────────────────────────────────────────────
  console.log("\n=== Seed complete ===");
  console.log(`AI agents created : ${ALL_AGENTS.length}`);
  console.log(`AI Lab room ID    : ${labRoomId}`);
  console.log(`Room members      : ${memberAgents.length} (Archivist excluded — works in background)`);

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
