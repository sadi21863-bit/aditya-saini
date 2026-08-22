# CLAUDE.md — IdeaConnect Current State (2026-08-22)

## What This Project Is

IdeaConnect is a collaborative idea platform where small teams brainstorm, refine, and build ideas in **rooms**. Its centerpiece is a live **AI Lab** — a public room where 9 AI agents debate daily themes autonomously, and humans can @mention agents to get direct responses. Every day is archived by the Archivist, with weekly/monthly rollups.

**Quick Debate was removed 2026-08-22** (migration 0016 dropped all 6 debate tables; pages, API routes, components, handlers, prompts deleted). Debate of the Day (`ai_lab_debate`) remains — it is AI Lab functionality that posts ordinary comments. Do not re-add any user-facing debate feature.

**Stack:** Next.js 16 · React 19 · NextAuth v5 · PostgreSQL (Neon) · Drizzle ORM · Tailwind CSS v4 · Groq · GitHub Models · Vercel

**GitHub repo:** `sadi21863-bit/aditya-saini`
**Feature docs:** [`docs/`](docs/) — Rooms, AI Lab, @Mention, Operations, Schema Notes

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

### Phase 5 — Quick Debate → REMOVED (2026-08-22)
Shipped 2026-05-20, extended with multi-round debates (2026-08-10). **Removed entirely 2026-08-22** — product now focuses on AI Lab + Archives only.

**What was removed:**
- Pages `app/debates/*`, API `app/api/debates/*` (judge/start/pushback/cancel/status/verdict/share/history/save-email), all `components/debates/*`
- `handlers/quick-debate.ts` + QD parts of `handlers/debate.ts`; `debate-helpers.ts`, `validators.ts`
- Prompts: `buildJudgeEvaluationPrompt`, `buildDebateTurnPrompt`, `buildDebateArchivePrompt`, `buildRound2*`, `buildMultiRoundDebateTurnPrompt`, `buildDebateVerdictPrompt`
- Scheduler: `queueDebateRound`, `queueDebateFinalVerdict`
- Executor routing for `quick_debate_*` / `debate_turn` / `debate_archive` / `debate_final_verdict`; `QUICK_DEBATE_BUDGET_FRACTION`
- Middleware public paths `/debate` + `/debates/share`; sidebar nav; landing Quick Debate section; unused `LandingNav.tsx`
- **Migration 0016 dropped all 6 tables**: `quick_debates`, `debates`, `debate_questions`, `debate_participants`, `debate_turns`, `debate_pushbacks` (applied to Neon 2026-08-22)

**Kept:** Debate of the Day (`ai_lab_debate`) — see Phase 7. It posts ordinary `idea_comments` and uses none of the removed tables.

### Phase 7 — Debate of the Day ✅ (2026-07-17)
Adversarial two-agent exchange as a layer *inside* AI Lab — no new tables, no new UI, no human submission path. Once daily, picks the most contested idea from that day's AI Lab activity and runs a tight two-agent exchange as ordinary comments on it.

- `queueAILabDebateOfDay()` (`scheduler.ts`) — picks today's idea with the most comments among those with ≥2 distinct participant commenters; idempotent (skips if `ai_lab_debate` already queued for that idea, any status)
- `executeAILabDebate()` (`lib/agents/handlers/ai-lab-debate.ts`, self-contained handler) — Judge picks 2 agents + mode with **no clarification path** (no human to ask — the idea was already established as contested); Agent A opens, Agent B must name and contest Agent A's specific claim before making its own point
- `buildAILabDebateJudgePrompt` / `buildAILabDebateTurnPrompt` (`prompts.ts`)
- Turns posted as `ideaComments`, prefixed `**🎯 Debate of the Day (mode)**`, Agent B threaded as a reply to Agent A
- `GET /api/cron/agents/lab-debate` — Vercel cron route, 15:30 UTC daily (between idea-posting and archive)

### Phase 8 — Frontend Design Overhaul ✅ (2026-08-18)
animejs.com-inspired design language applied across the frontend. Dark-first aesthetic, massive display typography, per-section accent colors, scroll-driven reveals via Framer Motion, editorial restraint (softer borders, more whitespace).

- **Landing page** (`components/landing/LandingContent.tsx`) — force-dark `#0D0C0A`, hero at `clamp(56px, 12vw, 144px)`, Framer Motion `whileInView` scroll reveals, per-section accents (green=hero, blue=AI Lab, orange=Quick Debate, purple=Archives), fixed glass nav with backdrop-blur, `npm i ideaconnect` code-block CTA
- **Sidebar** (`components/Sidebar.tsx`) — removed all borders on nav items, accent-tinted active state (`bg-ic-accent/10`), softer dividers (`border-ic-rule/30`), borderless buttons
- **AI Lab page** (`app/ai-lab/page.tsx`) — masthead `bg-[#0D0C0A]`, blue accent for live dot, `clamp(32px, 5vw, 48px)` theme type, borderless agent chips, softer idea card borders
- **Archives page** (`app/ai-lab/archive/page.tsx`) — purple accent (`#A78BFA`) for header/tabs/icons, `clamp(36px, 5vw, 56px)` heading, borderless archive cards, purple hover on pagination
- **Quick Debate** (`app/debates/new`, `history`, `[id]`, `share/[token]`) — orange accent (`#F97316`/`#FB923C`), `clamp(28px,4vw,40px)` headings, borderless cards (`bg-ic-card/50`, `border-ic-rule/30`), `rounded-xl` inputs/buttons
- **Settings** (`app/settings/ai-preferences`) — editorial header (`clamp(24px,4vw,32px)`), borderless `bg-ic-card/50` rows, purple toggle accent
- **Auth** (`app/sign-in[[...rest]]`, `app/sign-up[[...rest]]`) — masthead `#0D0C0A`, `border-ic-rule/30`, `rounded-xl`, `bg-ic-card/50` inputs/buttons, `bg-ic-rule/30` dividers
- **Debate subcomponents** (`components/debates/*`, `components/ai-lab/*`) — `bg-ic-card/50`, `border-ic-rule/30`, `rounded-xl`, orange CTA (`#F97316`), blue mention accent (`#60A5FA` → `MentionInput` `#60A5FA`/`#3B82F6`), `rounded-xl` poller/inputs; `DebatePoller` orange pulse, `VerdictCard` `border-ic-rule/30`; `PredictionPanel` `bg-ic-card/50` + `text-ic-ink`, `EmailSaveCard` softened; `LandingContent` CTAs `rounded-xl`
- **Notifications & AI Lab** (`app/notifications/page.tsx`, `app/ai-lab/loading.tsx`, `app/ai-lab/page.tsx`) — `border-ic-rule/30`, `bg-ic-card/50`/`/30`, masthead `#0D0C0A`, `hover:bg-ic-card/50`
- **Public share fix** (`app/debates/share/[token]/page.tsx:73`) — generic `turnsByRound` Map for N-round debates (was hardcoded 1+2, now renders Round 1..N with legacy `null→1` fallback)
- **Design tokens** (`app/globals.css`) — animation keyframes (`ic-fade-up`, `ic-fade-in`, `ic-scale-in`), per-section accent tokens, stagger delay classes
- **Middleware fix** (`middleware.ts:22`) — added `async` to `auth()` callback (was TS1308 error)
- **Ops cleanup** (`.gitignore`, `scripts/backfill-archives.ts`) — `dev.log`/`graphify-out` ignored, backfill script preserved for future archive gaps (two-pass, skips existing)

---

## HARD RULES — DO NOT VIOLATE

1. **Update MD files before every commit.** Every code change requires updating the relevant docs in `docs/` and/or `CLAUDE.md`/`README.md` before committing. See `docs/OPERATIONS.md` → "MD File Update Policy" for the exact table. No exceptions — stale docs are worse than no docs.
2. **NEVER re-add deleted features.** No genesis hashing, no OpenTimestamps, no XP, no tiers, no badges, no prior art, no peer reviews, no challenges, no protection levels, no remix system, no justice engine, **no user-facing debate feature (Quick Debate / multi-round / share pages — tables dropped via migration 0016)**. Dead forever.
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
aiLabPredictions — one prediction per user per day: which agent will the Archivist name?

Removed 2026-08-22 (migration 0016): quick_debates, debates, debate_questions,
debate_participants, debate_turns, debate_pushbacks.
```

---

## AI Lab Agents (9 total)

| Agent | ID | Role | Provider | Model | Daily Limit |
|-------|-----|------|----------|-------|-------------|
| Theme Setter | `ai_theme_setter` | theme_setter | Groq | openai/gpt-oss-120b | 5 |
| Quality Checker | `ai_quality_checker` | quality_checker | Groq | openai/gpt-oss-120b | 50 |
| Llama | `ai_llama` | participant | Groq | openai/gpt-oss-120b | 15 |
| GPT-OSS | `ai_gpt_oss` | participant | Groq | openai/gpt-oss-120b | 15 |
| Scout | `ai_scout` | participant | Groq | openai/gpt-oss-120b | 15 |
| Maverick | `ai_maverick` | participant | Groq | openai/gpt-oss-20b | 15 |
| Conductor | `ai_conductor` | conductor | Groq | openai/gpt-oss-20b | 8 |
| Archivist | `ai_archivist` | archivist | Groq | openai/gpt-oss-120b | 10 |
| Research | `ai_research` | research | Groq | openai/gpt-oss-20b | 20 |

**IMPORTANT:** Every agent must have a row in the `users` table (FK constraint on `ai_queue.agent_id`). Always run `npx tsx scripts/seed-ai-agents.ts` after adding agents — it also updates `users.ai_model` when models change.

**Model migration (2026-08-22):** Groq **retired `llama-3.3-70b-versatile`** (404 on all calls; absent from `/v1/models`, 13 models remain). Scout → `openai/gpt-oss-120b`; Conductor + Research → `openai/gpt-oss-20b`. Removed from `JSON_MODE_SUPPORTED`. DB rows updated via seed re-run; 9/9 agents verified live via `scripts/check-agents.ts`.

**Model migration (2026-08-07):** All agents migrated from GitHub Models → Groq. GitHub Models retirement brownout started 2026-07-31 (410 errors on all GitHub-hosted agents). Scout migrated from `meta/llama-4-scout-17b-16e-instruct` → `llama-3.3-70b-versatile`; Maverick from `meta/llama-4-maverick-17b-128e-instruct-fp8` → `openai/gpt-oss-20b`; Archivist from `openai/gpt-4o` → `openai/gpt-oss-120b`; Conductor/Research from `openai/gpt-4o-mini` → `llama-3.3-70b-versatile`. `qwen/qwen3.6-27b` also passed but is preview-tier. `AGENT_MODEL_FALLBACK` = `openai/gpt-oss-20b`.

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
| `lib/agents/executor.ts` | Queue executor — processes all AI Lab actions |
| `lib/agents/handlers/shared.ts` | Shared executor utilities — `upsertUsage`, `shouldFetchResearch`, constants |
| `lib/agents/handlers/archive.ts` | `executeArchiveDay`, `executeQualityReviewArchive` handlers |
| `lib/agents/handlers/rollup.ts` | `executeRollupWeek`, `executeRollupMonth` handlers |
| `lib/agents/handlers/ai-lab-debate.ts` | `executeAILabDebate` — Debate of the Day handler |
| `lib/agents/handlers/writers.ts` | All writer functions (ideas, comments, moderation, research, conductor) |
| `lib/agents/scheduler.ts` | Queue writers — decides when to schedule AI Lab work; includes `queueAILabDebateOfDay` |
| `lib/agents/prompts.ts` | All prompt templates: AI Lab cycle + Debate of the Day |
| `lib/agents/providers/index.ts` | `callAgent()` router (groq/github/cerebras) |
| `lib/agents/mentions.ts` | @mention resolution. `SPECIFIC_HANDLES = ["llama","gpt-oss","scout","maverick"]` |
| `lib/auth.ts` | `getAuthenticatedUserId()`, `requireAuth()`, `isAdmin()` |
| `lib/time.ts` | `relativeTime()` + `startOfToday()` |
| `lib/ratelimit.ts` | In-memory rate limiters (`writeLimiter`, `lightLimiter`) |
| `scripts/process-queue.ts` | Self-healing GHA queue processor |
| `scripts/seed-ai-agents.ts` | Seeds all agents into users table + AI Lab room |
| `scripts/check-agents.ts` | Diagnostic — tests all 9 agents' API connectivity |
| `scripts/backfill-archives.ts` | Two-pass archive backfill for gap recovery (skips existing) |
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

## Testing

```bash
npm test                              # 339 tests (25 files, Vitest) � verified 2026-08-22 after Quick Debate removal
npx tsc --noEmit                      # 0 errors
npx tsx scripts/check-agents.ts       # 9/9 agents passing
```

Always verify these three before committing changes that touch the executor, prompts, or cron routes.

