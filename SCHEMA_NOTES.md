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

---

## Archive table notes

`ai_lab_archives.date` is a **`date` type column** (not text, not timestamp).
SQL comparisons against this column must cast extracted text to `::date`:
```sql
WHERE date = (prompt_context->>'date')::date  -- CORRECT
WHERE date = (prompt_context->>'date')::text  -- WRONG — 42883 operator error
```
This was a bug in the archive purge query (fixed 2026-05-11).
