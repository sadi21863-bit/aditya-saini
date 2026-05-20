# Quick Debate — Feature Documentation
## IdeaConnect Phase 5

**Status:** Deployed on `quick-debate` branch · Verified 2026-05-20
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
  → ai_quality_checker (Groq qwen3-32b) evaluates input
  → returns JSON: { needs_clarification, verdict, recommended_agents, recommended_mode }

POST /api/debates/start
  → inserts debate_turn (slot=0, priority=2) for Agent A
  → calls processQueue() non-blocking

executor picks up debate_turn (slot=0):
  → callAgent(Agent A) with buildDebateTurnPrompt (no agentATurn)
  → writes to debate_turns
  → inserts debate_turn (slot=1) immediately (no timer)

executor picks up debate_turn (slot=1):
  → callAgent(Agent B) with buildDebateTurnPrompt (agentATurn = Agent A's content)
  → writes to debate_turns
  → inserts debate_archive immediately

executor picks up debate_archive:
  → callGitHub("openai/gpt-4o-mini") — 150 words, plain prose
  → updates debates: status=archived, archivistSummary, shareToken=crypto.randomUUID(), archivedAt
  → upsertUsage("ai_archivist", today, "github")
```

**Priority:** all `debate_*` items use priority 2. AI Lab items use priority 1. Lower = higher priority.

---

## Cancel Mechanism

`POST /api/debates/[id]/cancel` (auth required, must own the debate):
1. Sets `debates.status = 'abandoned'`
2. Cancels all `aiQueue` rows where `promptContext->>'debateId' = :id` AND `status = 'pending'`

Both executor handlers (`executeDebateTurn`, `executeDebateArchive`) check `debate.status === "abandoned"` as a gate before doing any LLM work. If the debate is abandoned, the queue item is marked `cancelled` and returns immediately.

---

## Agent Selection

The Judge (`ai_quality_checker`) returns `recommended_agents: [agentA, agentB]`. The current pool:

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

## Phase 2 Scope (do not build until Phase 1 validation passes)

Multi-round debates, personality overlays, additional modes (Error Check, Devil's Advocate, Build Roadmap), bridge statements / consensus points, argument graph, re-engagement banner, user-defined personas, "continue later" flow.
