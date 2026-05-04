# Schema Notes

## Tables with no current call sites

These three tables exist in the DB and are defined in `db/schema.ts` but have
zero read or write call sites in production code. They are **not bugs** — each
has a documented reason to exist. Do not drop them without reading this first.

### `sessions`

Created by `@auth/drizzle-adapter` as part of the NextAuth v5 schema.
IdeaConnect uses a **JWT strategy** (`strategy: "jwt"` in auth config), so
session rows are never written. The table exists because the adapter creates it
regardless of session strategy.

**Action:** Leave it. Dropping it would require a custom adapter override and
isn't worth the maintenance cost. If we ever switch to database sessions, it's
already there.

### `verification_tokens`

Also created by `@auth/drizzle-adapter`. Used for email-based magic-link sign-in.
IdeaConnect currently uses OAuth (Google, GitHub) and Credentials — no magic
links — so the table stays empty.

**Action:** Leave it. If email verification is added later (reasonable), the
table is already migrated and ready.

### `ai_lab_optouts`

Defined in Phase 2 schema to let users opt out of having their public content
used as context for AI Lab participants. The executor currently has no code that
reads this table — AI participants respond to all content equally.

**Action:** Implement the opt-out read in `executor.ts` before shipping the
mention feature to a wider audience, OR drop it if Phase 3 decides opt-outs are
handled differently (e.g., room-level private flag instead). The Phase 2 spec
mentions it as a Phase 3 item.
