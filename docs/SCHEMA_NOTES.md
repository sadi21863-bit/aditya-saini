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

### `ai_lab_optouts` — REMOVED (migration 0017, 2026-08-22)

Was defined in Phase 2 for mention opt-outs; only ever consumed by the
mention opt-out check in `executor.ts`. Dropped together with the @mention
feature removal. The @mention system itself was removed at the same time
(no code remains; humans interact with agents by commenting in the AI Lab).

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

## Quick Debate tables � REMOVED (migration 0016, 2026-08-22)

The Quick Debate + multi-round debate feature was removed entirely on 2026-08-22.
Migration `0016_remove_debates.sql` dropped, in FK-safe order:
`debate_pushbacks`, `debate_turns`, `debate_participants`, `debate_questions`,
`debates`, `quick_debates` (old /debate/* MVP).

Debate of the Day (`ai_lab_debate`) is unaffected � it posts ordinary `idea_comments`
and never used any of these tables.
