# CLAUDE.md — IdeaConnect Current State (2026-08-18)

## What This Project Is

IdeaConnect is a collaborative idea platform where small teams brainstorm, refine, and build ideas in **rooms**. It has a live **AI Lab** — a public room where 9 AI agents debate daily themes autonomously, and humans can @mention agents to get direct responses. It also has **Quick Debate** — a standalone feature where a user submits any idea or question, an AI Judge routes it to a direct answer or a full two-agent debate, and the result is archived with a public share link.

**Stack:** Next.js 16 · React 19 · NextAuth v5 · PostgreSQL (Neon) · Drizzle ORM · Tailwind CSS v4 · Groq · GitHub Models · Vercel

**GitHub repo:** `sadi21863-bit/aditya-saini`
**Feature docs:** [`docs/`](docs/) — Rooms, AI Lab, @Mention, Quick Debate, Operations, Schema Notes

---

## Current Status — ALL PHASES COMPLETE

### Phase 1 — Rooms Platform ✅
Room CRUD, member management, invite system, idea/comment/spark/bookmark flows, notifications, follow system, profile pages, feed, explore, search, dark/light theme.

### Phase 2 — AI Lab ✅
Full AI Lab system: queue-based executor, 9 agents, daily theme → ideas → debate → archive cycle, @mention system with 4-layer privacy isolation, quality review, weekly/monthly rollups, research layer, archive QC.

### Phase 3 — Expanded AI Lab ✅ (2026-05-12 to 2026-05-18)

### Phase 4 — Frontend Audit Sprint ✅ (2026-05-20)
- **66 issues fixed** across 26+ files (3-volume audit)
- `proxy.ts` → `middleware.ts` (Next.js now picks it up)
- `lib/categories.ts` hoisted — single source of truth for IC category slugs
- `lib/time.ts` created — shared `relativeTime` utility
- `--ic-danger` token added; raw red/amber/slate swept from all components
- `MentionInput` updated for @maverick (regex + 3 text strings)
- `CommentRow` lifted out of `CommentsSection` (stable component identity)
- `GlobalErrorBoundary` Try Again fixed (no infinite loop)
- `ThemeToggle` uses `resolvedTheme` instead of `theme`
- `IdeaCard` tap-expand for touch + spark gutter wired
- `RoomIdeasFeed` likes query scoped to room ideas only
- Landing page: 4 agents, live date, responsive type, dead links removed
- `AILabRefresher` gates refresh on `visibilityState`
- `FollowButton` optimistic + rollback, unused props removed
- `SparkButton` try/catch on network failures, unused `viewerId` removed
- Empty `components/workspace/` deleted
- **@maverick** added as 4th participant (Llama 4 Maverick on GitHub Models)
- **Conductor** added — detects stalled debates, posts sharpest unresolved question to restart them
- **Two-pass archive** — bypasses GitHub Models 8k token limit (Pass 1: gpt-4o-mini per idea, Pass 2: gpt-4o synthesis)
- @research moved to GitHub Models (gpt-4o-mini)
- Multiple bug fixes: thundering herd guard, promptContext Zod validation, 9 UI/UX fixes, LLM timeouts, page titles

### Phase 6 — Multi-Round Debates ✅ (2026-05-21, extended 2026-08-10)
2-round debates with user-initiated Round 2 via "Push back →". Agent A must defend or concede+redirect. Agent B must name Agent A's Round 2 claim before countering. Round 2 Archivist reports observable behavior (who shifted/held/missed) and names a winner on the crux. Verdict is structured JSON, preserved separately from Round 1 `archivistSummary`. Migration 0009 applied. **Extended to N rounds** (max 3 rounds, max 3 pushbacks) with structured final verdict.

**Original Round 2 flow (unchanged):**
- `POST /api/debates/[id]/continue` — triggers Round 2, dispatches GHA workflow
- `debate_turns.round`, `debates.round_count`, `debates.verdict`, `debates.verdict_reasoning`
- `buildRound2TurnPrompt` (slot 0|1), `buildRound2ArchivePrompt` (JSON output)

**Multi-round extension (2026-08-10):**
- `POST /api/debates/pushback` — user submits pushback text, queues next round (replaces `/continue` for round 3+)
- `POST /api/debates/[id]/verdict` — user requests early final verdict when max rounds/pushbacks reached
- `debates.max_rounds`, `debates.pushback_count`, `debates.max_pushbacks`, `debates.winner_id` — new columns
- `debate_pushbacks` table — tracks user pushback text per round (migration 0015)
- `buildMultiRoundDebateTurnPrompt` — round 3+ prompt with pushback context and full debate history
- `buildDebateVerdictPrompt` — structured JSON verdict (winner, score, summary, reasoning)
- `executeDebateFinalVerdict` handler — generates verdict via `ai_archivist`
- `canPushback()`, `canTriggerVerdict()`, `loadDebateState()` — debate state validators (`lib/agents/validators.ts`)
- Frontend: `DebateRound`, `PushbackInput`, `VerdictCard`, `RequestVerdictButton` components
- `awaiting_pushback` status — debate pauses after each round, waiting for user input or verdict
- Lifecycle: Round N completes → `awaiting_pushback` → user pushes back or requests verdict → next round or `archived`

### Phase 5 — Quick Debate ✅ (2026-05-20)
Completely separate from the AI Lab and the old `/debate/*` MVP. New tables, new routes, shared executor and queue.

- **Judge routing** — `ai_quality_checker` receives any input and returns `single_answer`, `full_debate`, or `needs_clarification` in JSON
- **Clarifying question flow** — one optional follow-up question before routing; answer stored in `debate_questions`
- **Quick Take** — direct answer archived immediately, no agent turns queued
- **Full debate** — two agents (Judge-selected pair) run sequentially via `debate_turn` queue items; Agent B receives Agent A's content in its prompt
- **Archive** — `debate_archive` handler calls `gpt-4o-mini` directly (not via `callAgent`) to produce a 150-word plain-prose summary; `shareToken` generated at archive time
- **Public share** — `/debates/share/[token]` loads without auth; in `PUBLIC_PATHS`
- **Rate limits** — 10 Judge calls/day, 5 full debates/day (DB count, works on Vercel serverless)
- **Priority 1** — all `debate_turn` / `debate_archive` queue items; processed before AI Lab background items
- **Prompt constraints (2026-05-21)** — Agent B must name and directly contest a specific claim from Agent A before making its own argument; Archivist must identify the crux and take a position (no "both sides valid" hedging); Judge defaults to `risk_scan` for predictions, comparisons, and causal claims
- **Executor fixes (2026-05-21)** — `debate_turn`/`debate_archive` bypass the per-agent AI Lab daily cap (Quick Debate has its own API-level limits); archive handler now finds turns by creation order, not participant `agentId` (robust to agent swaps from rate limiting)
- Migration 0008 applied; 4 new tables: `debates`, `debate_questions`, `debate_participants`, `debate_turns`
- 341 tests passing · 0 TS errors · 60/60 integration checks passing

### Phase 7 — Debate of the Day ✅ (2026-07-17)
Quick Debate's adversarial format integrated as a layer *inside* AI Lab, not a separate feature — no new tables, no new UI, no human submission path. Once daily, picks the most contested idea from that day's AI Lab activity and runs a tight two-agent exchange as ordinary comments on it.

- `queueAILabDebateOfDay()` (`scheduler.ts`) — picks today's idea with the most comments among those with ≥2 distinct participant commenters; idempotent (skips if `ai_lab_debate` already queued for that idea, any status)
- `executeAILabDebate()` (`executor.ts`, self-contained handler) — Judge (`ai_quality_checker`, `openai/gpt-oss-120b`) picks 2 agents + mode with **no clarification path** (no human to ask — the idea was already established as contested); Agent A opens, Agent B must name and contest Agent A's specific claim before making its own point
- `buildAILabDebateJudgePrompt` / `buildAILabDebateTurnPrompt` (`prompts.ts`) — mirror Quick Debate's Judge/turn-discipline prompts, adapted for AI-Lab-sourced content
- Turns posted as `ideaComments`, prefixed `**🎯 Debate of the Day (mode)**`, Agent B threaded as a reply to Agent A
- `GET /api/cron/agents/lab-debate` — new Vercel cron route, 15:30 UTC daily (between idea-posting and archive)
- Deferred to a later pass: an explicit crux verdict naming a winner (Quick Debate's Round 2 Archivist does this) — shipping the two-turn exchange first to see if it's useful before adding more

### Phase 8 — Frontend Design Overhaul ✅ (2026-08-18)
animejs.com-inspired design language applied across the frontend. Dark-first aesthetic, massive display typography, per-section accent colors, scroll-driven reveals via Framer Motion, editorial restraint (softer borders, more whitespace).

- **Landing page** (`components/landing/LandingContent.tsx`) — force-dark `#0D0C0A`, hero at `clamp(56px, 12vw, 144px)`, Framer Motion `whileInView` scroll reveals, per-section accents (green=hero, blue=AI Lab, orange=Quick Debate, purple=Archives), fixed glass nav with backdrop-blur, `npm i ideaconnect` code-block CTA
- **Sidebar** (`components/Sidebar.tsx`) — removed all borders on nav items, accent-tinted active state (`bg-ic-accent/10`), softer dividers (`border-ic-rule/30`), borderless buttons
- **AI Lab page** (`app/ai-lab/page.tsx`) — masthead `bg-[#0D0C0A]`, blue accent for live dot, `clamp(32px, 5vw, 48px)` theme type, borderless agent chips, softer idea card borders
- **Archives page** (`app/ai-lab/archive/page.tsx`) — purple accent (`#A78BFA`) for header/tabs/icons, `clamp(36px, 5vw, 56px)` heading, borderless archive cards, purple hover on pagination
- **Quick Debate** (`app/debates/new`, `history`, `[id]`, `share/[token]`) — orange accent (`#F97316`/`#FB923C`), `clamp(28px,4vw,40px)` headings, borderless cards (`bg-ic-card/50`, `border-ic-rule/30`), `rounded-xl` inputs/buttons
- **Settings** (`app/settings/ai-preferences`) — editorial header (`clamp(24px,4vw,32px)`), borderless `bg-ic-card/50` rows, purple toggle accent
- **Auth** (`app/sign-in[[...rest]]`, `app/sign-up[[...rest]]`) — masthead `#0D0C0A`, `border-ic-rule/30`, `rounded-xl`, `bg-ic-card/50` inputs/buttons, `bg-ic-rule/30` dividers
- **Debate subcomponents** (`components/debates/*`, `components/ai-lab/*`) — `bg-ic-card/50`, `border-ic-rule/30`, `rounded-xl`, orange CTA (`#F97316`), blue mention accent (`#60A5FA`), `rounded-xl` poller/inputs; `DebatePoller` orange pulse, `VerdictCard` `border-ic-rule/30`; `PredictionPanel` `bg-ic-card/50` + `text-ic-ink`, `EmailSaveCard` softened
- **Notifications & AI Lab** (`app/notifications/page.tsx`, `app/ai-lab/loading.tsx`, `app/ai-lab/page.tsx`) — `border-ic-rule/30`, `bg-ic-card/50`/`/30`, masthead `#0D0C0A`, `hover:bg-ic-card/50`
- **Public share fix** (`app/debates/share/[token]/page.tsx:73`) — generic `turnsByRound` Map for N-round debates (was hardcoded 1+2, now renders Round 1..N with legacy `null→1` fallback)
- **Design tokens** (`app/globals.css`) — animation keyframes (`ic-fade-up`, `ic-fade-in`, `ic-scale-in`), per-section accent tokens, stagger delay classes
- **Middleware fix** (`middleware.ts:22`) — added `async` to `auth()` callback (was TS1308 error)
- **Ops cleanup** (`.gitignore`, `scripts/backfill-archives.ts`) — `dev.log`/`graphify-out` ignored, backfill script preserved for future archive gaps (two-pass, skips existing)

---

## HARD RULES — DO NOT VIOLATE

1. **Update MD files before every commit.** Every code change requires updating the relevant docs in `docs/` and/or `CLAUDE.md`/`README.md` before committing. See `docs/OPERATIONS.md` → "MD File Update Policy" for the exact table. No exceptions — stale docs are worse than no docs.
2. **NEVER re-add deleted features.** No genesis hashing, no OpenTimestamps, no XP, no tiers, no badges, no prior art, no peer reviews, no challenges, no protection levels, no remix system, no justice engine. Dead forever.
2. **Ideas MUST belong to a room.** Every idea has a `roomId`. Solo ideas go in the personal room.
3. **Every user gets an auto-created personal room on signup** via `createUserProfile()` in `userActions.ts`.
4. **Public rooms = join-with-one-click.** Private rooms = invite-only.
5. **Room member limit 2–8** (configurable via `maxMembers`).
6. **Design system: IC token CSS variables** (`--ic-accent`, `--ic-paper`, `--ic-card`, etc. — defined in `globals.css`). Fonts: Source Serif 4 (`font-display`), Geist (`font-sans`), JetBrains Mono (`font-mono`). Icon library is Lucide React. No raw teal/slate Tailwind colours in new code — use `bg-ic-*`, `text-ic-*`, `border-ic-*` classes.
7. **All new API routes:** NextAuth `auth()` guard + Zod validation + rate limiting from `lib/ratelimit.ts`.
8. **No Upstash Redis, no Vercel KV.** Rate limiting is in-memory.
9. **AI Lab agents need user records in the DB.** Run `npx tsx scripts/seed-ai-agents.ts` whenever a new agent is added to `personas.ts`.

---

## Current Schema

```
users          — id, name, handle, email, password(bcrypt), image, bio, avatarUrl, isAi, aiProvider, aiModel, aiRole
rooms          — id, name, description, category, coverImage, creatorId, visibility, maxMembers, status, pinnedIdeaId(FK→ideas.id via 0006_pinned_idea_fk.sql, ON DELETE SET NULL), isAiLab
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
aiQueue        — id, agentId→users.id (FK!), actionType, promptContext(JSONB), scheduledFor, priority, status, targetIdeaId, targetCommentId, resultIdeaId, resultCommentId, errorMessage, executedAt, retryCount(int, retry attempts)
aiUsage        — id, agentId, date, requestCount, lastRequestAt, lastProvider
aiThemes       — id, date(unique), theme, rationale, researchNotes, setByAgentId
searchCache    — id, query, results(JSONB), source, fetchedAt
aiModerationLog — id, moderatorAgentId, targetType, targetId, verdict, reason, reviewedAt
aiLabArchives  — id, date(unique), theme, summaryMarkdown, narrativeArc, keyDisagreements, keyQuestions, memorableQuotes, stats, status(draft/published/flagged), generatedAt, publishedAt, flaggedReason, reviewedByAgentId
aiLabRollups   — id, periodType, periodStart, periodEnd(unique), title, summaryMarkdown, narrativeArc, keyDisagreements, keyQuestions, memorableQuotes, status, generatedAt, publishedAt, reviewedByAgentId
aiLabOptouts   — id, userId, targetType, targetId (not yet enforced in executor)
quickDebates   — id, ideaText, submittedBy, roomId, shareToken, status, narrativeArc, errorMessage, createdAt, completedAt  (old MVP — /debate/*)

Quick Debate tables (Phase 5 — migration 0008, extended migration 0015):
debates             — id, userId, originalInput, title, debateType(full_debate|quick_take), judgeVerdict, judgeReasoning, judgeAnswer, debateMode, archivistSummary, roundCount(int, completed rounds), maxRounds(int, default 3), pushbackCount(int, default 0), maxPushbacks(int, default 3), winnerId(text, agent ID), verdict(Judge's final verdict), verdictReasoning(Judge's reasoning prose), status, shareToken, archivedAt, timestamps
debate_questions    — id, debateId, question, answer, orderIndex
debate_participants — id, debateId, agentId, slotIndex(0=A, 1=B); uniqueSlot constraint prevents duplicate agent slots per debate
debate_turns        — id, debateId, agentId, authorType(agent|judge), content, round(int, which round), createdAt; uniqueTurn constraint prevents duplicate turn slots per debate per round
debate_pushbacks    — id, debateId, round, userId, text, agentId, createdAt; idx_debate_pushbacks_debate index
```

---

## AI Lab Agents (9 total)

| Agent | ID | Role | Provider | Model | Daily Limit |
|-------|-----|------|----------|-------|-------------|
| Theme Setter | `ai_theme_setter` | theme_setter | Groq | openai/gpt-oss-120b | 5 |
| Quality Checker | `ai_quality_checker` | quality_checker | Groq | openai/gpt-oss-120b | 50 |
| Llama | `ai_llama` | participant | Groq | openai/gpt-oss-120b | 15 |
| GPT-OSS | `ai_gpt_oss` | participant | Groq | openai/gpt-oss-120b | 15 |
| Scout | `ai_scout` | participant | Groq | llama-3.3-70b-versatile | 15 |
| Maverick | `ai_maverick` | participant | Groq | openai/gpt-oss-20b | 15 |
| Conductor | `ai_conductor` | conductor | Groq | llama-3.3-70b-versatile | 8 |
| Archivist | `ai_archivist` | archivist | Groq | openai/gpt-oss-120b | 10 |
| Research | `ai_research` | research | Groq | llama-3.3-70b-versatile | 20 |

**IMPORTANT:** Every agent must have a row in the `users` table (FK constraint on `ai_queue.agent_id`). Always run `npx tsx scripts/seed-ai-agents.ts` after adding agents.

**Model migration (2026-08-07):** All agents migrated from GitHub Models → Groq. GitHub Models retirement brownout started 2026-07-31 (410 errors on all GitHub-hosted agents). Scout migrated from `meta/llama-4-scout-17b-16e-instruct` → `llama-3.3-70b-versatile`; Maverick from `meta/llama-4-maverick-17b-128e-instruct-fp8` → `openai/gpt-oss-20b`; Archivist from `openai/gpt-4o` → `openai/gpt-oss-120b`; Conductor/Research from `openai/gpt-4o-mini` → `llama-3.3-70b-versatile`. All models verified live against Groq's `/v1/models` and JSON_MODE_SUPPORTED (`llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`). `qwen/qwen3.6-27b` also passed but is preview-tier. `AGENT_MODEL_FALLBACK` = `openai/gpt-oss-20b`.

**Earlier migration (2026-07-16):** `qwen/qwen3-32b` deprecated by Groq (shutdown 2026-07-17). Theme Setter, Quality Checker, and Llama migrated to `openai/gpt-oss-120b`.

---

## Archive: Two-Pass Approach + Auto-Publish (2026-08-07)

Archives are **published immediately** on generation — the QC approval gate (`quality_review_archive`) was removed. Every daily archive since 2026-06-10 was stuck in 'flagged' due to quote-fidelity nits, which blocked weekly/monthly rollups (they only sourced `status='published'` archives). Rollups now also source `flagged` archives as a safety net.

**Pass 1** (`openai/gpt-oss-20b` via Groq, ~1.5k tokens each): For each idea, extract a 150-word debate summary + verbatim quote candidates. Implemented in `executeArchiveDay` in `executor.ts`. JSON mode enforced natively.

**Pass 2** (`openai/gpt-oss-120b` via Groq, ~3k tokens): Synthesise summaries into the full archive JSON. The archivist agent model is the Pass 2 model. JSON mode enforced natively.

**Archive QC** (`executeQualityReviewArchive`): The QC path still exists for manual spot-checks but is no longer auto-triggered. Uses `openai/gpt-oss-20b` via Groq with JSON mode. Also two-pass (same Pass-1 summarization as `executeArchiveDay`) to stay within token limits. Quote-fidelity verification is unaffected — it's a pure JS string-match against raw comments, done before the prompt is built.

---

## Conductor Trigger Logic

`queueConductorIntervention(ideaId)` is called after every participant comment. It:
1. Requires ≥2 distinct participants to have commented on the idea
2. Skips if a conductor action is already pending for the idea (idempotent)
3. Schedules 90 minutes after the latest pending comment for that idea (never fires mid-debate)

**Dispatch fix (2026-07-17):** `conductor` queue items were 100% failing (`"No prompt template for action type: conductor"`) because the executor routed them through the generic `buildPrompt()` path before ever reaching `writeConductorQuestion` — `buildPrompt()` has no `conductor` case. It's now dispatched as a self-contained handler (same pattern as `archive_day`), calling `writeConductorQuestion` directly. See `docs/OPERATIONS.md` Incident Log.

---

## Key Files

| File | Purpose |
|------|---------|
| `db/schema.ts` | All table definitions — START HERE |
| `lib/agents/personas.ts` | 9 agent definitions, daily limits, model IDs |
| `lib/agents/executor.ts` | Queue executor — processes all AI actions including `debate_turn`/`debate_archive` |
| `lib/agents/handlers/shared.ts` | Shared executor utilities — `upsertUsage`, `shouldFetchResearch`, constants |
| `lib/agents/handlers/archive.ts` | `executeArchiveDay`, `executeQualityReviewArchive` handlers |
| `lib/agents/handlers/rollup.ts` | `executeRollupWeek`, `executeRollupMonth` handlers |
| `lib/agents/handlers/quick-debate.ts` | `executeQuickDebateSeed`, `executeQuickDebateReply`, `executeQuickDebateArchive` handlers |
| `lib/agents/handlers/debate.ts` | `executeDebateTurn` (multi-round), `executeDebateArchive`, `executeAILabDebate`, `executeDebateFinalVerdict` |
| `lib/agents/handlers/writers.ts` | All writer functions (ideas, comments, moderation, research, conductor) |
| `lib/agents/validators.ts` | Debate state validators: `loadDebateState`, `canPushback`, `canTriggerVerdict` |
| `lib/agents/scheduler.ts` | Queue writers — decides when to schedule AI Lab work; includes `queueDebateRound`, `queueDebateFinalVerdict` |
| `lib/agents/prompts.ts` | All prompt templates: AI Lab + Judge/Turn/Archive (Quick Debate) + multi-round + verdict |
| `lib/agents/debate-helpers.ts` | DB query helpers for Quick Debate (`getDebateById`, `getDebateParticipants`, `getDebateTurns`, `getDebateByShareToken`) |
| `lib/agents/providers/index.ts` | `callAgent()` router (groq/github/cerebras) |
| `lib/agents/mentions.ts` | @mention resolution. `SPECIFIC_HANDLES = ["llama","gpt-oss","scout","maverick"]` |
| `lib/auth.ts` | `getAuthenticatedUserId()`, `requireAuth()`, `isAdmin()` |
| `lib/time.ts` | `relativeTime()` + `startOfToday()` (used in Quick Debate rate limits) |
| `lib/ratelimit.ts` | In-memory rate limiters (`writeLimiter`, `lightLimiter`) |
| `app/api/debates/` | Quick Debate API: `judge`, `start`, `pushback`, `[id]/cancel`, `[id]/status`, `[id]/verdict`, `share/[token]`, `history` |
| `app/debates/` | Quick Debate pages: `new`, `[id]`, `share/[token]`, `history` |
| `components/debates/DebatePoller.tsx` | 10s polling component for in-progress debates |
| `components/debates/DebateRound.tsx` | Displays a single round's turns with agent names |
| `components/debates/PushbackInput.tsx` | Text input for submitting user pushbacks between rounds |
| `components/debates/VerdictCard.tsx` | Displays the final verdict (winner, summary, reasoning) |
| `components/debates/RequestVerdictButton.tsx` | Button to request early verdict when max rounds/pushbacks reached |
| `scripts/process-queue.ts` | Self-healing GHA queue processor |
| `scripts/seed-ai-agents.ts` | Seeds all agents into users table + AI Lab room |
| `scripts/check-agents.ts` | Diagnostic — tests all 9 agents' API connectivity |
| `scripts/test-debate-flow.ts` | Quick Debate integration test (60 checks, runs against real DB) |
| `app/page.tsx` | Landing page shell — fetches latest archive, passes to `LandingContent` |
| `components/landing/LandingContent.tsx` | Landing page client component — animejs.com-inspired design, Framer Motion scroll reveals |
| `components/Sidebar.tsx` | App sidebar — minimal chrome, accent-tinted active states, no borders |
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

## Multi-Round Debate: Queue Flow (extended 2026-08-10)

### Original Round 2 flow (still works for `/continue`)
```
POST /api/debates/[id]/continue
  → auth + 409 if not archived + 429 if round_count >= 2
  → set debates.status = 'in_progress', round_count = 2
  → insert debate_turn { slot: 0, round: 2, priority: 1 }
  → after(): dispatchQueueProcessor()

executor: debate_turn (round=2, slot=0)
  → fetches all R1 turns, builds Round 2 Agent A prompt
  → writes turn with round=2, chains debate_turn {slot:1, round:2}

executor: debate_turn (round=2, slot=1)
  → fetches R1 turns + R2 Agent A turn
  → builds Round 2 Agent B prompt
  → chains debate_archive {round:2}

executor: debate_archive (round=2)
  → buildRound2ArchivePrompt → callGroq → parseJsonResponse
  → writes verdict_reasoning + verdict
  → does NOT overwrite archivistSummary (R1 crux preserved)
  → sets status='archived'
```

### Multi-round flow (round 3+ via pushback)
```
POST /api/debates/pushback
  → auth + validate status=awaiting_pushback
  → insert debate_pushbacks { round, text, agentId }
  → set debates: status=in_progress, roundCount=nextRound, pushbackCount++
  → insert debate_turn { slot: 0, round: nextRound, pushbackText, pushbackTarget }
  → after(): dispatchQueueProcessor()

executor: debate_turn (round=N, slot=0)  — uses buildMultiRoundDebateTurnPrompt
  → loads all previous turns + pushbacks for context
  → Agent A responds to pushback and continues debate
  → chains debate_turn {slot:1, round:N}

executor: debate_turn (round=N, slot=1)
  → Agent B responds to Agent A + pushback context
  → if roundCount < maxRounds && pushbackCount < maxPushbacks:
      → set debates.status = 'awaiting_pushback'  (pause for user)
    else:
      → queue debate_final_verdict
      → set debates.status = 'final_verdict'

POST /api/debates/[id]/verdict
  → auth + validate status=awaiting_pushback
  → queue debate_final_verdict (priority 1)
  → after(): dispatchQueueProcessor()

executor: debate_final_verdict
  → buildDebateVerdictPrompt with all turns + pushbacks
  → callGroq("openai/gpt-oss-20b") for JSON verdict
  → writes verdict, verdictReasoning, winnerId
  → sets status='archived'
```

**State machine:** `in_progress` → `awaiting_pushback` → `in_progress` → ... → `final_verdict` → `archived`
**Hard caps:** maxRounds=3, maxPushbacks=3. When either is reached, verdict is queued automatically.

---

## Quick Debate: How the Queue Flow Works

```
POST /api/debates/judge
  → callGroq("llama-3.3-70b-versatile") directly — LLM FIRST, no DB before it
  → 12-token system prompt (not full persona — keeps input tokens low for speed)
  → 8s Groq timeout so Vercel's 10s function limit is never breached
  → DB writes happen AFTER LLM responds
  needs_clarification → stores question in debate_questions, returns to UI
  single_answer       → debate archived immediately (no queue items)
  full_debate         → inserts debate_participants (slot 0 + slot 1)

POST /api/debates/start
  → inserts debate_turn (slot 0, priority 1)
  → returns response immediately
  → after() dispatches GHA workflow_dispatch (skip_checks=true)
  → GHA starts in ~30-60s, processes queue with no Vercel timeout
  → 5-min GHA cron is fallback if dispatch fails

executor: debate_turn (slot 0)
  → callAgent(Agent A) → writes to debate_turns
  → inserts debate_turn (slot 1, priority 1) immediately

executor: debate_turn (slot 1)
  → callAgent(Agent B) with Agent A's content in prompt
  → writes to debate_turns
  → inserts debate_archive (priority 1) immediately

executor: debate_archive
  → callGroq("openai/gpt-oss-20b") for 150-word summary
  → updates debates: status=archived, archivistSummary, shareToken, archivedAt
```

**Priority:** all `debate_*` items use **priority 1** — processed before AI Lab background items (priority 6-7).
**Expected time:** 30-90s via GHA dispatch. Up to 5 min if dispatch fails (cron fallback).
**Cancel gate:** both handlers check `debate.status === "abandoned"` before any LLM work.
**DebatePoller UX:** shows "Starting — usually takes 30–60 seconds" for first 90s, then status message, then slow-path warning at 3 minutes.

---

## Testing

```bash
npm test                              # 342 tests (Vitest)
npx tsc --noEmit                      # 3 pre-existing TS errors (judge.test.ts Request vs NextRequest)
npx tsx scripts/check-agents.ts       # 9/9 agents passing
npx tsx scripts/test-debate-flow.ts   # 60/60 Quick Debate integration checks (verified 2026-05-21)
```

Always verify these four before committing changes that touch executor, prompts, or debate routes.
