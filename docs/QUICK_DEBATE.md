# Quick Debate — Feature Documentation
## IdeaConnect Phase 5

**Status:** Live on `main` · Verified 2026-05-20 · Post-launch fixes 2026-05-21
**Routes:** `/debates/*` (new) — completely separate from `/debate/*` (old MVP)

---

## What It Does

A user submits any idea or question (10–2000 chars). An AI Judge routes it:

| Verdict | What happens | DB result |
|---------|-------------|-----------|
| `needs_clarification` | One follow-up question shown | `debate_questions` row created; user answers and resubmits |
| `single_answer` | Judge answers directly | `debates.judgeAnswer` populated; status=archived immediately |
| `full_debate` | Two agents debate | `debate_participants` created; queue flow begins |

Result is always shareable via `/debates/share/[token]` — no login required to view.

---

## Rate Limits

- **10 Judge calls/day** — counts all `debates` rows for the user created since midnight local time
- **5 full debates/day** — counts `debates` rows where `judgeVerdict=full_debate` and `status != abandoned`

Both limits use DB count queries (not in-memory state), so they work correctly on Vercel serverless.

---

## Queue Flow

```
POST /api/debates/judge
  → callGroq("llama-3.3-70b-versatile") with 12-token system prompt
  → LLM call happens FIRST — no DB before it (avoids Neon cold-start blocking)
  → DB writes happen AFTER verdict returns
  → 8s timeout on Groq call so Vercel's 10s limit is never hit cold

POST /api/debates/start
  → DB writes (rate limit check, debate validation, aiQueue insert)
  → returns response immediately
  → after() fires: processQueue(1) loop up to 4 passes in same warm function
      Pass 1: Agent A turn (~2-3s, Groq)
      Pass 2: Agent B turn (~2-3s, Groq/GitHub)
      Pass 3: Archive (~1-2s, GitHub gpt-4o-mini)
  → GHA 5-min cron handles any passes that got cut by Vercel's 10s limit

executor picks up debate_turn (slot=0):
  → callAgent(Agent A) with buildDebateTurnPrompt (no agentATurn)
  → writes to debate_turns
  → inserts debate_turn (slot=1, priority=1) immediately

executor picks up debate_turn (slot=1):
  → callAgent(Agent B) with buildDebateTurnPrompt (agentATurn = Agent A's content)
  → writes to debate_turns
  → inserts debate_archive (priority=1) immediately

executor picks up debate_archive:
  → callGitHub("openai/gpt-4o-mini") — 150 words, plain prose
  → updates debates: status=archived, archivistSummary, shareToken, archivedAt
```

**Priority:** all `debate_*` items use **priority 1** (same as AI Lab urgent items). Lower = higher priority. This ensures the after() loop processes them first in the same tick.

**Expected end-to-end time:** 5-15 seconds on warm Vercel functions. Up to 5 minutes on cold start (GHA fallback).

---

## Cancel Mechanism

`POST /api/debates/[id]/cancel` (auth required, must own the debate):
1. Sets `debates.status = 'abandoned'`
2. Cancels all `aiQueue` rows where `promptContext->>'debateId' = :id` AND `status = 'pending'`

Both executor handlers (`executeDebateTurn`, `executeDebateArchive`) check `debate.status === "abandoned"` as a gate before doing any LLM work. If the debate is abandoned, the queue item is marked `cancelled` and returns immediately.

---

## Agent Selection

The Judge uses `llama-3.3-70b-versatile` via `callGroq()` directly (NOT `callAgent` — avoids sending the full 450-token llama persona as system prompt). A 12-token system prompt is used instead, cutting input tokens from ~850 to ~418 for faster response. Returns `recommended_agents: [agentA, agentB]`. The current pool:

| Agent | Handle | Style | Provider |
|-------|--------|-------|---------|
| `ai_llama` | @llama | Practical builder | Groq |
| `ai_gpt_oss` | @gpt-oss | Synthesizer/connector | Groq |
| `ai_scout` | @scout | Explorer/lateral | GitHub Models |
| `ai_maverick` | @maverick | Bold/contrarian | GitHub Models |

Judge pairs one builder-type with one skeptic-type for tension. Default fallback: `["ai_llama", "ai_maverick"]`.

---

## Debate Modes

Set by Judge in `debates.debateMode`:

| Mode | Agent instruction |
|------|-----------------|
| `brainstorm` | Build on the idea. Find adjacent applications and unexplored angles. |
| `risk_scan` | Find failure modes. One concrete risk per paragraph. |

---

## Public Share Page

`/debates/share/[token]` — no auth required. In `PUBLIC_PATHS` in `middleware.ts`.

Shows:
- Original idea as heading
- Judge's routing reasoning (italic)
- Each agent turn with avatar
- Archivist summary block
- "Try it on IdeaConnect →" CTA

OG metadata: title from `debate.title`, description from `archivistSummary.slice(0, 155)`.

---

## File Map

| File | Purpose |
|------|---------|
| `db/schema.ts` | `debates`, `debate_questions`, `debate_participants`, `debate_turns` tables |
| `lib/agents/debate-helpers.ts` | `getDebateById`, `getDebateByShareToken`, `getDebateParticipants`, `getDebateTurns` |
| `lib/agents/prompts.ts` | `buildJudgeEvaluationPrompt`, `buildDebateTurnPrompt`, `buildDebateArchivePrompt` |
| `lib/agents/executor.ts` | `executeDebateTurn`, `executeDebateArchive` (bottom of file) |
| `lib/time.ts` | `startOfToday()` used for daily rate limit count queries |
| `app/api/debates/judge/route.ts` | POST — Judge call + clarification handling |
| `app/api/debates/start/route.ts` | POST — Queue Agent A + trigger processQueue |
| `app/api/debates/[id]/cancel/route.ts` | POST — Abandon debate |
| `app/api/debates/[id]/status/route.ts` | GET — Polling endpoint for DebatePoller |
| `app/api/debates/share/[token]/route.ts` | GET — Public archive data |
| `app/api/debates/history/route.ts` | GET — User's last 50 debates |
| `app/debates/new/page.tsx` | Submission form + clarification UI |
| `app/debates/[id]/page.tsx` | Result: quick take answer or debate archive |
| `app/debates/share/[token]/page.tsx` | Public archive page |
| `app/debates/history/page.tsx` | History grouped by status |
| `components/debates/DebatePoller.tsx` | 10s polling, 15min timeout, visibility-aware |
| `drizzle/0008_debates.sql` | Migration SQL (applied 2026-05-20) |
| `scripts/test-debate-flow.ts` | Integration test — 60 checks against real DB |

---

## Known Limitations (Phase 1)

- **One round only** — each debate is exactly two turns (Agent A + Agent B). Multi-round is Phase 2.
- **No re-engagement** — in-progress debates have no "come back later" banner. DebatePoller runs for 15 minutes then shows a refresh button.
- **No user-defined agents** — Judge picks from the pool of 4 debate agents.
- **No argument graph** — turns are flat (no `parent_turn_id` or `stance` fields).
- **Archive only** — there is no live streaming of turns as they are written.

---

## Known Phase 1 Gaps (not regressions)

**No manual archive trigger** — `POST /api/debates/[id]/archive` was not implemented. If the `debate_archive` queue item fails permanently, the debate stays on `in_progress` and the DebatePoller shows a refresh button after 15 minutes. The user has no way to trigger the archive themselves. Workaround: wait for GHA to retry, or admin resets the queue item. Add this endpoint in Phase 2.

**No re-engagement banner** — In-progress debates have no "pick up where you left off" UI. Users who leave and return see the DebatePoller spinning. Add in Phase 2.

**One round only** — Each debate is exactly two turns. Multi-round is Phase 2.

---

## Phase 2 Scope (do not build until Phase 1 validation passes)

Multi-round debates, personality overlays, additional modes (Error Check, Devil's Advocate, Build Roadmap), bridge statements / consensus points, argument graph, re-engagement banner, user-defined personas, "continue later" flow, `POST /api/debates/[id]/archive` manual trigger.
