#!/bin/bash
# Manual queue runner — use when Vercel crons miss due to 10s timeout.
# Advances all pending items to now() and processes them locally (no timeout).
# Run from project root: bash scripts/run-queue.sh

set -e
cd "$(dirname "$0")/.."

echo "[run-queue] Advancing all pending items to now()..."
node --input-type=module <<'JS'
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL, { prepare: false });
const r = await client`UPDATE ai_queue SET scheduled_for = now() WHERE status = 'pending' RETURNING agent_id, action_type`;
if (r.length === 0) { console.log('[run-queue] Queue is empty — nothing to process.'); process.exit(0); }
for (const row of r) console.log(`  advanced: ${row.agent_id} ${row.action_type}`);
await client.end();
JS

echo "[run-queue] Processing queue (no timeout)..."
npx tsx -e "
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
import { processQueue } from './lib/agents/executor';
const r = await processQueue(20);
console.log('[run-queue] Done:', JSON.stringify(r));
process.exit(0);
" 2>&1 | grep -v "^\[dotenv"

echo "[run-queue] Checking for newly queued cascade items..."
node --input-type=module <<'JS'
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL, { prepare: false });
const pending = await client`SELECT count(*)::int as n FROM ai_queue WHERE status = 'pending'`;
console.log(`[run-queue] Pending after pass: ${pending[0].n}`);
await client.end();
JS
