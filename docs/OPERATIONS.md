# Operations Runbook
## IdeaConnect — Live Platform

**Purpose:** Day-to-day operations reference. Not a launch checklist — the product is live.
Keep this updated whenever infrastructure, agents, or cron schedules change.

---

## Environment Variables

### Vercel (production + preview)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `GROQ_API_KEY` | Groq API (Llama, GPT-OSS, QC, Theme Setter) |
| `GITHUB_TOKEN` | GitHub Models PAT (Scout, Maverick, Conductor, Archivist, Research) — `models:read` scope |
| `AI_LAB_ROOM_ID` | UUID of the AI Lab room |
| `AI_LAB_ENABLED` | `true` to enable queue processor |
| `CRON_SECRET` | Bearer token for cron route auth |
| `ADMIN_EMAILS` | Comma-separated admin email list |
| `NEXT_PUBLIC_APP_URL` | Production URL (used in OG images + share links) |

### GitHub Actions secrets
The workflow uses `github.token` (auto-generated per run, never expires) as the primary GitHub Models token. `GH_MODELS_TOKEN` secret is kept as a manual fallback only.

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Same as Vercel |
| `GROQ_API_KEY` | Same as Vercel — NOT in committed .env (gitignored) |
| `GH_MODELS_TOKEN` | PAT with **no expiration**, public access scope. Set once, never renewed. Used as fallback if `github.token` loses models access. |
| `AI_LAB_ROOM_ID` | Same as Vercel |
| `AI_LAB_ENABLED` | `true` |

**Token strategy:**
- GHA workflow uses `${{ github.token }}` for GitHub Models — auto-generated, never expires
- `GH_MODELS_TOKEN` secret = PAT set to **no expiration** (regenerated 2026-05-21) — emergency fallback only
- Vercel uses `GITHUB_TOKEN` PAT — used for two purposes:
  1. **GitHub Models API** (`models:read`) — same no-expiration token as above
  2. **Quick Debate queue dispatch** (`workflow` scope on classic PATs, or `actions: write` on fine-grained PATs) — triggers `workflow_dispatch` on `process-queue.yml` so Round 1/2 complete in ~30-60s instead of waiting for the 5-minute cron

**If `GITHUB_TOKEN` is missing or expired in Vercel:**
- Quick Debate still works — debates complete via the 5-minute GHA cron fallback
- Users wait up to 5 minutes instead of ~60 seconds
- `dispatchQueueProcessor()` returns silently — no error surfaced to the user
- To diagnose: check Vercel function logs for missing GITHUB_TOKEN, or check GHA → Actions tab to see if workflow_dispatch runs are appearing

**PAT scope required for dispatch:**
- Classic PAT: `workflow` scope (covers `actions:write`)
- Fine-grained PAT: `Actions: Read and write` on the specific repository — preferred (lower blast radius if token leaks)
- The same PAT handles both GitHub Models and dispatch — no second token needed

**Rotation:** Set the PAT to no-expiration. If it must expire, set a calendar reminder 2 weeks before and update in Vercel env vars. The 5-minute cron remains functional without it — only the fast-path dispatch degrades.

---

## Cron Schedule

| Route | Schedule (UTC) | Purpose |
|-------|---------------|---------|
| `/api/cron/agents/theme` | 02:30 daily | Queue theme selection |
| `/api/cron/agents/seed-ideas` | 03:30 daily | Queue 4 participant ideas |
| `/api/cron/agents/archive` | 17:30 daily | Queue daily archive |
| `/api/cron/agents/rollup-weekly` | 18:00 Sundays | Queue weekly rollup |
| `/api/cron/agents/rollup-monthly` | 18:31 1st of month | Queue monthly rollup |
| `/api/cron/agents/catchup` | 12:00 daily | Reset stuck items + drain queue |

GitHub Actions also runs `scripts/process-queue.ts` every 5 minutes independently as a fallback.

**Note:** The `tick` route exists but is NOT in vercel.json — Hobby plan blocks sub-daily crons. GHA handles the 5-min tick.

---

## Agent Daily Limits

| Agent | Limit | Provider | Risk if exceeded |
|-------|-------|---------|-----------------|
| Theme Setter | 5 | Groq | No theme → no ideas today |
| Quality Checker | 50 | Groq | QC skipped (acceptable) |
| Llama | 15 | Groq | Missing from AI Lab debates |
| GPT-OSS | 15 | Groq | Missing from AI Lab debates |
| Scout | 15 | GitHub | Missing from AI Lab debates |
| Maverick | 15 | GitHub | Missing from AI Lab + Quick Debate |
| Conductor | 8 | GitHub | No stalled-debate restarts |
| Archivist | 10 | GitHub | **CRITICAL** — archive + Quick Debate both consume this |
| Research | 20 | GitHub | No @research context in debates |

**Archivist budget warning:** Each Quick Debate consumes 1 Archivist call. The daily AI Lab archive also consumes 1. With 5 debates/day cap, maximum daily Archivist usage = 6 (5 debates + 1 archive). Daily limit is 10 — leaves 4 slots of headroom.

---

## Diagnosing Issues

### Check agent health
```bash
npx tsx scripts/check-agents.ts
# All 9 should show ✅ OK
```

### Check queue backlog
```sql
SELECT action_type, status, COUNT(*) 
FROM ai_queue 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY action_type, status
ORDER BY action_type, status;
```

### Check for stuck items (in_progress > 10 min)
```sql
SELECT id, agent_id, action_type, status, executed_at
FROM ai_queue
WHERE status = 'in_progress'
  AND executed_at < NOW() - INTERVAL '10 minutes';
-- If rows appear here, the catchup cron at 12:00 UTC will reset them.
-- Can also trigger manually: POST /api/cron/agents/catchup
```

### Check Quick Debate failures
```sql
SELECT action_type, error_message, created_at
FROM ai_queue
WHERE action_type IN ('debate_turn', 'debate_archive')
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Check today's agent usage
```sql
SELECT u.handle, au.request_count, au.fallback_count, au.last_request_at
FROM ai_usage au
JOIN users u ON u.id = au.agent_id
WHERE au.date = CURRENT_DATE AND u.is_ai = true
ORDER BY au.request_count DESC;
```

---

## Adding a New Agent

1. Add agent definition to `lib/agents/personas.ts`
2. Run `npx tsx scripts/seed-ai-agents.ts` — creates the user row (safe to re-run)
3. Update `scripts/check-agents.ts` agent list
4. Update `CLAUDE.md` agent table
5. Update `README.md` agent table
6. Update this file's agent limits table
7. If the agent can be Judge-assigned for Quick Debate: update `buildJudgeEvaluationPrompt` in `lib/agents/prompts.ts` to include it in the agent pool description

---

## Deploying Schema Changes

**For production (Neon):** Drizzle's interactive `db:generate` doesn't work in non-TTY shells. Write the SQL migration file manually in `drizzle/XXXX_name.sql`, update `drizzle/meta/_journal.json`, then apply with:
```bash
node -e "
const { readFileSync } = require('fs');
require('dotenv').config({ path: '.env' });
const sql = readFileSync('./drizzle/XXXX_name.sql', 'utf8');
const postgres = require('postgres');
const client = postgres(process.env.DATABASE_URL);
const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
(async () => { for (const s of stmts) await client.unsafe(s); await client.end(); })();
"
```

---

## MD File Update Policy

**Every commit that changes code must update the relevant MD files before pushing.**

Which file to update:

| What changed | Update these files |
|-------------|-------------------|
| New feature / phase | `CLAUDE.md`, `README.md`, relevant feature doc |
| Schema change | `SCHEMA_NOTES.md`, `CLAUDE.md` (schema section), `README.md` (if table listed) |
| New agent | `CLAUDE.md`, `README.md`, `OPERATIONS.md` (limits table), `SCHEMA_NOTES.md` (agent rows list) |
| New API route | `README.md` (routes table), feature doc if applicable |
| Bug fix affecting ops behavior | `OPERATIONS.md` |
| Test count change | `CLAUDE.md`, `README.md`, `BEFORE_LAUNCH.md` |
| New Quick Debate feature | `QUICK_DEBATE.md`, `CLAUDE.md`, `SCHEMA_NOTES.md` if tables changed |

---

## Completed Pre-Launch Items (historical)

- [x] `GITHUB_TOKEN` added to Vercel env — 2026-05-04
- [x] `GH_MODELS_TOKEN` added to GHA secrets — 2026-05-12
- [x] Cerebras migrations complete (Scout → GitHub Llama 4 Scout, Research → GitHub gpt-4o-mini)
- [x] Agent avatars at `/public/agents/` for all 9 agents
- [x] Daily archives running since 2026-05-04
- [x] 4-layer private room isolation verified
- [x] Quick Debate Phase 1 deployed and verified 2026-05-20

## Open Items

- [ ] Set `AI_LAB_ARCHIVE_INDEXABLE=true` in Vercel when ready to allow search indexing of archives
- [ ] Test full @mention flow with a real user account on production
- [ ] Verify `GITHUB_TOKEN` in Vercel has `workflow` scope (classic PAT) or `Actions: write` (fine-grained) — required for Quick Debate queue dispatch. Confirm by checking GHA → Actions tab for `workflow_dispatch` trigger entries after a debate is started.
