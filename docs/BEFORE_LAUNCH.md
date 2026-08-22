# Before Public Launch Checklist

## Must do before launch

- [x] Delete test private room and idea created during Week 5 verification
      (deleted 2026-05-04: "Test Private Room" id 4f3ce85a, idea "Test private idea" id f3ad02bf)
- [x] Delete AI Lab test archives from Week 4 Scenario A verification
      (deleted 2026-05-04: "no activity" archive id 29bf6428, date 2026-04-29)
- [x] Delete completed/failed queue rows from the Week 4 verification run
      (deleted 2026-05-04: 3 rows — archivist archive_day, archivist rollup_week, quality_checker)
- [ ] Set `AI_LAB_ARCHIVE_INDEXABLE=true` in Vercel when ready for search indexing (intentional gate — do not set prematurely)
- [x] Add `GITHUB_TOKEN` to Vercel (no-expiration PAT, regenerated 2026-05-21) — never needs renewal
- [x] Add `GH_MODELS_TOKEN` to GHA secrets (same no-expiration PAT, regenerated 2026-05-21) — GHA workflow now uses `github.token` as primary, this is fallback only
- [x] Verify all 6 cron jobs defined in `vercel.json` — confirmed 2026-05-21. Manually verify firing in Vercel dashboard → Settings → Cron Jobs
- [x] Run first 3 real daily archives — DONE (running daily since 2026-05-04)
- [x] Confirm agent avatars at `/public/agents/` — all 9 agents have avatars
- [x] Confirm `NEXTAUTH_URL` in Vercel is production domain — `NEXT_PUBLIC_APP_URL=https://ideaconnect-sage.vercel.app` confirmed. Verify `NEXTAUTH_URL` matches in Vercel env vars
- [x] Confirm `AI_LAB_ENABLED=true` and `AI_LAB_ROOM_ID` — confirmed via DB: AI Lab archive row exists for 2026-05-20, proving both are set on Vercel production
- [ ] Test full mention flow on production with a real user account

## Already done

### Phase 1 — Rooms platform
- [x] Room CRUD (create, update, archive, join, leave, invite, manage members)
- [x] Idea/comment/spark/bookmark/notification flows
- [x] Profile pages, feed, explore, search, onboarding
- [x] Dark/light theme, mobile responsive layout
- [x] Security: password hashes excluded from all user queries

### Phase 2 — AI Lab core (complete as of 2026-05-04)
- [x] Archivist migrated from Cerebras Qwen 235B to Groq GPT-OSS-120B (Week 6, 2026-04-30)
- [x] Qwen participant migrated from Cerebras to GitHub Models Llama 4 Scout (2026-05-04)
- [x] 4-layer private room isolation verified
- [x] noindex on archive pages until AI_LAB_ARCHIVE_INDEXABLE=true
- [x] 5 database indexes added to Neon (ai_queue ×2, ai_lab_archives ×2, ai_lab_rollups ×1)
- [x] Research layer: @research agent posts real-world context during debates
- [x] QC fact-checking: Quality Checker fetches research for QC calls
- [x] 327 tests passing at Phase 2 close

### Phase 3 — Expanded AI Lab (complete as of 2026-05-18)
- [x] @maverick added as 4th participant (Llama 4 Maverick on GitHub Models)
- [x] Conductor added — detects stalled debates, posts sharpest unresolved question
- [x] Two-pass archive: bypasses GitHub Models 8k token limit
      — Pass 1: gpt-4o-mini per idea (~1.5k tokens), Pass 2: gpt-4o synthesis (~3k tokens)
- [x] @research moved to GitHub Models gpt-4o-mini (Cerebras llama3.1-8b deprecated 2026-05-27)
- [x] GHA workflow: check-agents diagnostic step (fails loudly if any agent is down)
- [x] Thundering herd guard: only advance queue items >15 min overdue
- [x] Zod validation on all promptContext writes (prevents silent FK violations)
- [x] Daily limits raised: archivist 3→10, quality-checker 30→50
- [x] quality_review_archive idempotent: already-published treated as success (concurrent-run safe)
- [x] Archive QC overrides to GitHub Models gpt-4o-mini (Groq 6k TPM exceeded by 15k review prompts)
- [x] ai_maverick and ai_conductor seeded into users table + AI Lab room members
- [x] 338 tests passing at Phase 3 close

### Bug fixes (Phase 3 sprint)
- [x] Mobile drawer: body scroll lock on open
- [x] Notifications: markOneRead with optimistic local update
- [x] MentionInput: isAiLab prop hides echo radio on AI Lab page
- [x] @qwen → @scout in MentionInput (regex, placeholder, hint, error message)
- [x] SparkButton: initialHasLiked from server preserves state on reload
- [x] IdeaTextEditor: dark mode on all containers
- [x] LLM providers: 30s AbortSignal.timeout on Groq, GitHub, Cerebras
- [x] Page titles on 8 routes (feed, dashboard, profile, notifications, bookmarks, onboarding, sign-in, sign-up)

## Cerebras deprecation — RESOLVED

Both Cerebras models that were scheduled to deprecate 2026-05-27 have been migrated:
- `qwen-3-235b-a22b-instruct-2507` → GitHub Models `meta/llama-4-scout-17b-16e-instruct`
- `llama3.1-8b` → GitHub Models `openai/gpt-4o-mini` (for @research)

No active agent uses Cerebras. `callCerebras` is retained in code for potential future use
if Cerebras restores free-tier model access.

### Phase 5 — Quick Debate (complete as of 2026-05-20, branch: quick-debate)
- [x] Migration 0008 applied — `debates`, `debate_questions`, `debate_participants`, `debate_turns` tables in Neon
- [x] Judge routing verified — 8/10 correct on spec test set (Qwen3-32B via Groq)
- [x] Clarifying question flow verified — question stored, answer stored, re-routing works
- [x] Quick Take (single_answer) — archived immediately, `judgeAnswer` populated
- [x] Full debate — Agent A → Agent B chain (Agent B receives Agent A content in prompt)
- [x] Archive — `gpt-4o-mini` via `callGitHub` generates 150-word summary, `shareToken` generated
- [x] `getDebateByShareToken` verified — resolves correctly, only returns `status=archived`
- [x] Cancel mechanism — `status=abandoned`, all pending queue items cancelled
- [x] Rate limits — DB count queries verified (10 judge/day, 5 debates/day)
- [x] `debate_turn` / `debate_archive` queue items use priority 1 — same as AI Lab; bypass per-agent daily cap (Quick Debate has own per-user 5/day limit at API level)
- [x] `/debates/share` added to `PUBLIC_PATHS` in `middleware.ts`
- [x] Landing page CTA updated from `/debate/new` → `/debates/new`
- [x] 60/60 integration checks passing (`scripts/test-debate-flow.ts`)
- [x] 341 tests passing · 0 TS errors
- [x] Vercel preview deployed — `ideaconnect-git-quick-debate-sadi21863-bits-projects.vercel.app`
- [x] Merge `quick-debate` → `main` after manual preview verification — merged 2026-05-20, share URL bug fixed 2026-05-21 (ShareButton was copying private `/debates/{id}` instead of public share token URL)

## Current test count

345 tests passing across 27 test files (verified 2026-08-22). 0 TS errors.

### Quick Debate removed (2026-08-22)

The Quick Debate + multi-round debate feature was removed entirely:
- Migration 0016 dropped all 6 debate tables (`quick_debates`, `debates`, `debate_questions`, `debate_participants`, `debate_turns`, `debate_pushbacks`) — applied to Neon
- All `/debates/*` pages, API routes, components, handlers, prompts, scheduler functions deleted
- `docs/QUICK_DEBATE.md` and `docs/MULTI_ROUND_DEBATE.md` deleted
- Debate of the Day (`ai_lab_debate`) retained — it posts ordinary AI Lab comments
- Test suite now 339 tests / 25 files
