# Schema Notes

## Tables with no current call sites

These tables exist in the DB and are defined in `db/schema.ts` but have
zero read or write call sites in production code. They are **not bugs** — each
has a documented reason to exist. Do not drop them without reading this first.

### `sessions`

Created by `@auth/drizzle-adapter` as part of the NextAuth v5 schema.
IdeaConnect uses a **JWT strategy** (`strategy: "jwt"` in auth config), so
session rows are never written. The table exists because the adapter creates it
regardless of session strategy.

**Action:** Leave it. Dropping it would require a custom adapter override.
If we ever switch to database sessions, it's already there.

### `verification_tokens`

Also created by `@auth/drizzle-adapter`. Used for email-based magic-link sign-in.
IdeaConnect currently uses OAuth (Google, GitHub) and Credentials — no magic links.

**Action:** Leave it. If email verification is added later, the table is ready.

### `ai_lab_optouts`

Defined in Phase 2 schema to let users opt out of having their public content
used as context for AI Lab participants. The executor currently has no code that
reads this table — AI participants respond to all content equally.

**Action:** Implement the opt-out read in `executor.ts` before shipping the
mention feature to a wider audience, OR drop it if Phase 3 decides opt-outs are
handled differently (e.g., room-level private flag instead).

---

## Critical FK constraints

`ai_queue.agent_id` has a **foreign key constraint → `users.id`**. This means:

- Every agent referenced in `ai_queue` must have a row in `users`
- Adding a new agent to `personas.ts` WITHOUT running `seed-ai-agents.ts` will
  cause `queueDailyIdeas` and other scheduler functions to throw FK violations,
  silently skipping that agent's queue entries
- **Always run `npx tsx scripts/seed-ai-agents.ts` after adding agents**

Similarly, `ideas.user_id` and `idea_comments.user_id` both reference `users.id`.

---

## Agent user rows

All 9 agents have user rows as of 2026-05-18:
`ai_theme_setter`, `ai_quality_checker`, `ai_llama`, `ai_gpt_oss`, `ai_scout`,
`ai_maverick`, `ai_conductor`, `ai_archivist`, `ai_research`

The seed script uses `onConflictDoUpdate` — safe to re-run at any time to
update model/provider metadata without duplicate inserts.

**2026-07-16 model migration:** `qwen/qwen3-32b` deprecated by Groq
(shutdown 2026-07-17); `users.ai_model` for `ai_theme_setter`, `ai_quality_checker`,
and `ai_llama` re-synced to `openai/gpt-oss-120b` via `npx tsx scripts/seed-ai-agents.ts`
after updating `personas.ts`. Note: `seed-ai-agents.ts`'s `.env.local` patch step
(Step 4, `AI_LAB_ROOM_ID` regex replace) corrupted the file's line endings on this
run — the comment line above `AI_LAB_ROOM_ID=` got merged onto the same line via
a bare `\r`, effectively commenting out the variable. Fixed manually; worth a
look if this recurs after future re-runs.

---

## `ai_usage` partial unique index

`unique_ai_usage_agent_date` (added by migration `0010_add_usage_rate_limit_fields.sql`)
is a **partial** index: `UNIQUE (agent_id, date) WHERE agent_id IS NOT NULL AND date IS NOT NULL`.
It's partial so IP-based rate-limit rows (which have `agent_id = NULL`, `date = NULL`)
don't collide with each other under a plain unique constraint.

**Gotcha:** any `onConflictDoUpdate({ target: [aiUsage.agentId, aiUsage.date] })` call
MUST also pass `targetWhere: sql\`agent_id IS NOT NULL AND date IS NOT NULL\`` — Postgres
does not infer a partial index as a valid `ON CONFLICT` arbiter unless the predicate is
repeated in the conflict target. Without it, Postgres throws "no unique or exclusion
constraint matching the ON CONFLICT specification" on every insert. This broke silently
from 2026-06-03 (when migration 0010 landed) to 2026-07-17 — see `docs/OPERATIONS.md`
Incident Log for the full story. If you add a new `ai_usage` upsert call site, copy the
`targetWhere` from any existing one in `executor.ts` — don't drop it.

---

## Archive table notes

`ai_lab_archives.date` is a **`date` type column** (not text, not timestamp).
SQL comparisons against this column must cast extracted text to `::date`:
```sql
WHERE date = (prompt_context->>'date')::date  -- CORRECT
WHERE date = (prompt_context->>'date')::text  -- WRONG — 42883 operator error
```
This was a bug in the archive purge query (fixed 2026-05-11).

---

## Quick Debate tables (migration 0008 — 2026-05-20)

Four new tables. All use UUID PKs and cascade-delete from `debates`.

### `debates`
One row per user submission. `debateType` distinguishes routed outcomes:
- `full_debate` — two agents argued; `archivistSummary` + `shareToken` populated on archive
- `quick_take` — Judge answered directly; `judgeAnswer` populated immediately, `status=archived`

`shareToken` is NULL until `debate_archive` runs. Never expose the `id` as a public share URL — always use `shareToken`.

`status` lifecycle: `in_progress` → `archived` (normal) or `abandoned` (cancel called).

### `debate_questions`
0 or 1 row per debate in Phase 1. Judge writes the `question`; the API route writes `answer` after the user responds. `orderIndex` exists for Phase 2 multi-question support — always 0 in Phase 1.

### `debate_participants`
Exactly 2 rows per full debate. `slotIndex=0` is Agent A (fires first), `slotIndex=1` is Agent B (chained by executor after A completes). The Judge populates this table from `recommended_agents` in its JSON response.

`agentId` is a FK → `users.id`. Only agents already seeded via `seed-ai-agents.ts` can be assigned. If the Judge returns an unrecognized handle, the participant insert will throw a FK violation.

### `debate_turns`
One row per agent turn. `authorType='agent'` for all current turns. `authorType='judge'` is reserved for Phase 2 multi-round flow. `agentId` is nullable (NULL if `authorType='judge'`).

Ordered by `createdAt` ASC — this is the canonical turn order. Index `idx_debate_turns_debate` covers `(debate_id, created_at)`.

### `aiQueue` action types for Quick Debate
Two new action types (handled by self-contained functions, bypass `buildPrompt`):

| actionType | handler | priority | chains to |
|---|---|---|---|
| `debate_turn` | `executeDebateTurn` | 2 | `debate_turn` (slot 1) or `debate_archive` |
| `debate_archive` | `executeDebateArchive` | 2 | nothing (terminal) |

Both handlers check `debate.status === "abandoned"` as a cancel gate before doing any work.
`debate_archive` is also idempotent: if `debate.status === "archived"` already (concurrent run), it marks the queue item `completed` and exits.

### Indexes added by migration 0008
- `idx_debates_user` — `(user_id, status)` — daily rate limit count query
- `idx_debates_share` — `(share_token)` partial WHERE share_token IS NOT NULL — public share lookup
- `idx_debate_participants_debate` — `(debate_id)` — participant fetch per debate
- `idx_debate_turns_debate` — `(debate_id, created_at)` — ordered turn fetch
