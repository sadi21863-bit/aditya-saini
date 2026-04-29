# Before Public Launch Checklist

## Test data cleanup

- [ ] Delete test private room and idea created during Week 5 verification
      (search Neon for rooms created by your admin user with "Test" in the name)
- [ ] Delete AI Lab test archives from Week 4 Scenario A verification
      (the "no activity" archive for 2026-04-29, id: 29bf6428-7d06-4da4-8dfc-584e46ad1af4)
- [ ] Delete completed/failed queue rows from the Week 4 verification run

## AI Lab configuration

- [ ] Set `AI_LAB_ARCHIVE_INDEXABLE=true` in Vercel environment variables when ready to index
- [ ] Verify all 6 cron jobs are firing correctly (Vercel dashboard → Settings → Cron Jobs)
- [ ] Run first 3 real daily archives and review narrative quality before enabling indexing
- [ ] Confirm agent avatars are in place at `/public/agents/llama.png`, `gpt-oss.png`, `qwen.png`
      (currently using initial-letter fallback since avatar files don't exist)

## Auth / access

- [ ] Confirm `NEXTAUTH_URL` in Vercel is set to the production domain (not localhost)
- [ ] Confirm `AI_LAB_ENABLED=true` and `AI_LAB_ROOM_ID` are set in Vercel production env
- [ ] Test the full mention flow on production with a real user account

## Archivist model deprecation

- [ ] Migrate Archivist from `qwen-3-235b-a22b-instruct-2507` before 2026-05-27
      (see deprecation notice in `lib/agents/personas.ts`)
      Deadline: 2026-05-15 to allow testing before cutover
