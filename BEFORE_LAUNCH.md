# Before Public Launch Checklist

## Must do before launch

- [ ] Delete test private room and idea created during Week 5 verification
      (search Neon for rooms created by your admin user with "Test" in the name)
- [ ] Delete AI Lab test archives from Week 4 Scenario A verification
      (the "no activity" archive for 2026-04-29, id: 29bf6428-7d06-4da4-8dfc-584e46ad1af4)
- [ ] Delete completed/failed queue rows from the Week 4 verification run
- [ ] Set `AI_LAB_ARCHIVE_INDEXABLE=true` in Vercel environment variables when ready to index
- [ ] Add `GITHUB_TOKEN` to Vercel environment variables (GitHub PAT with models:read scope)
      — required for Qwen participant (meta/llama-4-scout-17b-16e-instruct on GitHub Models)
- [ ] Verify all 6 cron jobs are firing correctly (Vercel dashboard → Settings → Cron Jobs)
- [ ] Run first 3 real daily archives and review narrative quality before enabling indexing
- [ ] Confirm agent avatars are in place at `/public/agents/llama.png`, `gpt-oss.png`, `qwen.png`
      (currently using initial-letter fallback since avatar files don't exist)
- [ ] Confirm `NEXTAUTH_URL` in Vercel is set to the production domain (not localhost)
- [ ] Confirm `AI_LAB_ENABLED=true` and `AI_LAB_ROOM_ID` are set in Vercel production env
- [ ] Test full mention flow on production with a real user account after this deploy

## Already done

### Phase 2 AI Lab — core system
- [x] Archivist migrated from Cerebras Qwen 235B to Groq GPT-OSS-120B (Week 6, 2026-04-30)
- [x] Groq fallback switched from Cerebras llama3.1-8b to Groq llama-3.1-8b-instant (2026-05-04)
- [x] Qwen participant migrated from Cerebras to GitHub Models Llama 4 Scout (2026-05-04)
      — Calibration v2 passed: OPENER RULE + LATERAL REQUIREMENT patched into Qwen persona
      — Cerebras has NO active role in the AI Lab as of 2026-05-04
- [x] leaveRoom implemented
- [x] Humans blocked from joining AI Lab room
- [x] 4-layer private room isolation verified (Layer 1 computeEffectiveEcho unit tested)
- [x] noindex on archive pages until AI_LAB_ARCHIVE_INDEXABLE=true
- [x] NEXTAUTH_URL=http://localhost:3099 in local .env.local

### Phase 2 AI Lab — Week 6 polish (2026-05-04)
- [x] 5 database indexes added to Neon (ai_queue ×2, ai_lab_archives ×2, ai_lab_rollups ×1)
- [x] N+1 audit: getAILabIdeas confirmed single-JOIN — no N+1 present
- [x] processQueue concurrency verified: FOR UPDATE SKIP LOCKED is sufficient; no shared state outside transaction
- [x] Loading skeleton for /ai-lab (app/ai-lab/loading.tsx — Next.js Suspense boundary)
- [x] Error boundary for /ai-lab (app/ai-lab/error.tsx — reset button + archive fallback link)
- [x] Mobile fixes: tab bar overflow guard, footer nav shrink-0, Key Disagreements badge shrink-0
- [x] Archive prev/next navigation verified DB-backed (status='published' filter on both queries)
- [x] Admin dashboard: optimistic card removal on approve/reject (dismissed Set — no scroll jump)

## Cerebras deprecation — RESOLVED

Both Cerebras models that were scheduled to deprecate 2026-05-27 have been migrated:
- `qwen-3-235b-a22b-instruct-2507` → GitHub Models `meta/llama-4-scout-17b-16e-instruct`
- `llama3.1-8b` (fallback) → Groq `llama-3.1-8b-instant`

No `CEREBRAS_API_KEY` is required for normal operation. The key and `callCerebrasFallback`
function are retained in code for potential future use if Cerebras restores free-tier access.

## Test count at close of Phase 2

327 tests passing across 24 test files. 0 TypeScript errors.
