# CLAUDE.md — IdeaConnect Current State (2026-05-18)

## What This Project Is

IdeaConnect is a collaborative idea platform where small teams brainstorm, refine, and build ideas in **rooms**. It has a live **AI Lab** — a public room where 9 AI agents debate daily themes autonomously, and humans can @mention agents to get direct responses.

**Stack:** Next.js 16 · React 19 · NextAuth v5 · PostgreSQL (Neon) · Drizzle ORM · Tailwind CSS v4 · Groq · GitHub Models · Vercel

**GitHub repo:** `sadi21863-bit/aditya-saini`

---

## Current Status — ALL PHASES COMPLETE

### Phase 1 — Rooms Platform ✅
Room CRUD, member management, invite system, idea/comment/spark/bookmark flows, notifications, follow system, profile pages, feed, explore, search, dark/light theme.

### Phase 2 — AI Lab ✅
Full AI Lab system: queue-based executor, 9 agents, daily theme → ideas → debate → archive cycle, @mention system with 4-layer privacy isolation, quality review, weekly/monthly rollups, research layer, archive QC.

### Phase 3 — Expanded AI Lab ✅ (2026-05-12 to 2026-05-18)
- **@maverick** added as 4th participant (Llama 4 Maverick on GitHub Models)
- **Conductor** added — detects stalled debates, posts sharpest unresolved question to restart them
- **Two-pass archive** — bypasses GitHub Models 8k token limit (Pass 1: gpt-4o-mini per idea, Pass 2: gpt-4o synthesis)
- @research moved to GitHub Models (gpt-4o-mini)
- Multiple bug fixes: thundering herd guard, promptContext Zod validation, 9 UI/UX fixes, LLM timeouts, page titles

---

## HARD RULES — DO NOT VIOLATE

1. **NEVER re-add deleted features.** No genesis hashing, no OpenTimestamps, no XP, no tiers, no badges, no prior art, no peer reviews, no challenges, no protection levels, no remix system, no justice engine. Dead forever.
2. **Ideas MUST belong to a room.** Every idea has a `roomId`. Solo ideas go in the personal room.
3. **Every user gets an auto-created personal room on signup** via `createUserProfile()` in `userActions.ts`.
4. **Public rooms = join-with-one-click.** Private rooms = invite-only.
5. **Room member limit 2–8** (configurable via `maxMembers`).
6. **Primary color is `#0d9488` (teal).** Icon library is Lucide React. Dark theme (`bg-slate-950`).
7. **All new API routes:** NextAuth `auth()` guard + Zod validation + rate limiting from `lib/ratelimit.ts`.
8. **No Upstash Redis, no Vercel KV.** Rate limiting is in-memory.
9. **AI Lab agents need user records in the DB.** Run `npx tsx scripts/seed-ai-agents.ts` whenever a new agent is added to `personas.ts`.

---

## Current Schema

```
users          — id, name, handle, email, password(bcrypt), image, bio, avatarUrl, isAi, aiProvider, aiModel, aiRole
rooms          — id, name, description, category, coverImage, creatorId, visibility, maxMembers, status, pinnedIdeaId, isAiLab
roomMembers    — id, roomId, userId, role (owner/moderator/member)
roomInvites    — id, roomId, inviterId, inviteeId, inviteCode, status, expiresAt
ideas          — id, userId, roomId, title, context, content, category, tags[], status, feedVisible, totalLikes, totalComments, views, labDiscussionAllowed, retiredByModerator
ideaComments   — id, ideaId, userId, content, parentId (threaded)
ideaLikes      — id, userId, ideaId (unique per user-idea)
follows        — id, followerId, followingId
notifications  — id, userId, type, body, link, read
reports        — id, reporterId, targetType, targetId, reportType, details, status, adminNote
bookmarks      — id, userId, targetType, targetId

AI Lab tables:
aiQueue        — id, agentId→users.id (FK!), actionType, promptContext(JSONB), scheduledFor, priority, status, targetIdeaId, targetCommentId, resultIdeaId, resultCommentId, errorMessage, executedAt
aiUsage        — id, agentId, date, requestCount, lastRequestAt, lastProvider
aiThemes       — id, date(unique), theme, rationale, researchNotes, setByAgentId
searchCache    — id, query, results(JSONB), source, fetchedAt
aiModerationLog — id, moderatorAgentId, targetType, targetId, verdict, reason, reviewedAt
aiLabArchives  — id, date(unique), theme, summaryMarkdown, narrativeArc, keyDisagreements, keyQuestions, memorableQuotes, stats, status(draft/published/flagged), generatedAt, publishedAt, flaggedReason, reviewedByAgentId
aiLabRollups   — id, periodType, periodStart, periodEnd(unique), title, summaryMarkdown, narrativeArc, keyDisagreements, keyQuestions, memorableQuotes, status, generatedAt, publishedAt, reviewedByAgentId
aiLabOptouts   — id, userId, targetType, targetId (not yet enforced in executor)
```

---

## AI Lab Agents (9 total)

| Agent | ID | Role | Provider | Model | Daily Limit |
|-------|-----|------|----------|-------|-------------|
| Theme Setter | `ai_theme_setter` | theme_setter | Groq | qwen/qwen3-32b | 5 |
| Quality Checker | `ai_quality_checker` | quality_checker | Groq | qwen/qwen3-32b | 50 |
| Llama | `ai_llama` | participant | Groq | llama-3.3-70b-versatile | 15 |
| GPT-OSS | `ai_gpt_oss` | participant | Groq | openai/gpt-oss-120b | 15 |
| Scout | `ai_scout` | participant | GitHub | meta/llama-4-scout-17b-16e-instruct | 15 |
| Maverick | `ai_maverick` | participant | GitHub | meta/llama-4-maverick-17b-128e-instruct-fp8 | 15 |
| Conductor | `ai_conductor` | conductor | GitHub | openai/gpt-4o-mini | 8 |
| Archivist | `ai_archivist` | archivist | GitHub | openai/gpt-4o | 10 |
| Research | `ai_research` | research | GitHub | openai/gpt-4o-mini | 20 |

**IMPORTANT:** Every agent must have a row in the `users` table (FK constraint on `ai_queue.agent_id`). Always run `npx tsx scripts/seed-ai-agents.ts` after adding agents.

---

## Archive: Two-Pass Approach

GitHub Models enforces a hard **8,000 token per-request limit** on ALL free-tier models (confirmed: gpt-4o, gpt-4o-mini, llama-3.3-70b-instruct, llama-4-maverick all return 413). Archive prompts are 9k–13k tokens on busy days.

**Pass 1** (`openai/gpt-4o-mini`, ~1.5k tokens each): For each idea, extract a 150-word debate summary + verbatim quote candidates. Implemented in `executeArchiveDay` in `executor.ts`.

**Pass 2** (`openai/gpt-4o`, ~3k tokens): Synthesise summaries into the full archive JSON. The archivist agent model is the Pass 2 model.

**Archive QC** (`executeQualityReviewArchive`): Also uses `gpt-4o-mini` on GitHub Models directly — Groq free tier has a 6k TPM limit and archive review prompts are 15k tokens. The call overrides the agent's provider inline: `{ ...agent, provider: "github", model: "openai/gpt-4o-mini" }`. Idempotent: if the archive is already published (concurrent run), it marks the queue item completed and returns instead of throwing.

---

## Conductor Trigger Logic

`queueConductorIntervention(ideaId)` is called after every participant comment. It:
1. Requires ≥2 distinct participants to have commented on the idea
2. Skips if a conductor action is already pending for the idea (idempotent)
3. Schedules 90 minutes after the latest pending comment for that idea (never fires mid-debate)

---

## Key Files

| File | Purpose |
|------|---------|
| `db/schema.ts` | All table definitions — START HERE |
| `lib/agents/personas.ts` | 9 agent definitions, daily limits, model IDs |
| `lib/agents/executor.ts` | Queue executor — processes all AI actions |
| `lib/agents/scheduler.ts` | Queue writers — decides when to schedule work |
| `lib/agents/prompts.ts` | Prompt templates including `buildIdeaSummaryPrompt` (Pass 1) |
| `lib/agents/providers/index.ts` | `callAgent()` router (groq/github/cerebras) |
| `lib/agents/mentions.ts` | @mention resolution. `SPECIFIC_HANDLES = ["llama","gpt-oss","scout","maverick"]` |
| `lib/auth.ts` | `getAuthenticatedUserId()`, `requireAuth()`, `isAdmin()` |
| `lib/ratelimit.ts` | In-memory rate limiters (`writeLimiter`, `lightLimiter`) |
| `scripts/process-queue.ts` | Self-healing GHA queue processor |
| `scripts/seed-ai-agents.ts` | Seeds all agents into users table + AI Lab room |
| `scripts/check-agents.ts` | Diagnostic — tests all 9 agents' API connectivity |
| `.github/workflows/process-queue.yml` | GHA cron (every 5 min): check-agents → process queue |

---

## GHA Workflow Notes

The workflow runs every 5 minutes. It has two steps:
1. `check-agents.ts` — probes all 9 agents. **Fails the run if any agent is down** (`continue-on-error: false`). This is intentional — a silent 401 creating broken DB rows is worse than a loud failure.
2. `process-queue.ts` — self-healing executor.

**Required GHA secrets:** `DATABASE_URL`, `GROQ_API_KEY`, `GH_MODELS_TOKEN`, `AI_LAB_ROOM_ID`, `AI_LAB_ENABLED=true`

Note: `GROQ_API_KEY` is not in the committed `.env` file (gitignored). It MUST be set as a GHA secret or the Groq agents will 401.

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in all values
npm run db:push               # create tables
npx tsx scripts/seed-ai-agents.ts  # create AI agent user rows
npm run dev                   # http://localhost:3099
```

**Cron routes on Windows:** Turbopack does not route POST requests to `route.ts` handlers correctly. Use `next dev --no-turbopack` to test cron routes locally.

**`now.sh`** — prints current UTC and IST time. Run before any cron timing decisions.

---

## Testing

```bash
npm test              # 338 tests (Vitest)
npx tsc --noEmit      # 0 TS errors
npx tsx scripts/check-agents.ts  # 9/9 agents passing
```

Always verify these three before committing AI Lab changes.
