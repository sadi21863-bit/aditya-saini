# CLAUDE.md — IdeaConnect v15 Project Context

## READ FIRST: PHASE1_BLUEPRINT.md
Before making ANY changes, read `PHASE1_BLUEPRINT.md` in the project root. It contains the full technical spec, schema, kill list, and implementation plan. That document is the single source of truth.

---

## What Is This Project?

IdeaConnect is a collaborative idea platform where small teams brainstorm, refine, and build ideas together in **rooms**. Think "Discord meets Notion for ideas" — more structured than chat, simpler than a project management tool.

**Core loop:** Create Room → Invite People → Post Structured Ideas → Discuss & Refine

**Stack:** Next.js 16, React 19, Clerk auth, PostgreSQL (Neon), Drizzle ORM, Tailwind CSS, Vercel deployment.

**GitHub repo:** `sadi21863-bit/aditya-saini`

---

## What Just Happened (v15 Pivot — Week 1 COMPLETE)

IdeaConnect was previously an IP protection / idea timestamping platform. It has been completely pivoted to a rooms-first collaboration platform. Week 1 (the "kill phase") is DONE:

- **36+ files deleted** — all genesis hashing, OpenTimestamps, AI analysis (Groq), justice engine, tier system, XP/badges, prior art claims, peer reviews, challenges, protection levels, remix system
- **7 dead tables removed** — genesisHashes, xpEvents, challenges, challengeSubmissions, priorArtClaims, aiQueue, reviews
- **3 new tables added** — rooms, roomMembers, roomInvites
- **Schema is 11 tables total** — users, rooms, roomMembers, roomInvites, ideas, ideaComments, ideaLikes, follows, notifications, reports, bookmarks
- **12 files rewritten from scratch** — schema, ideaActions, dashboard, feed, profile, idea pages, IdeaCard, IdeaDetailClient, CommentsSection, IdeaForm, Sidebar
- **TypeScript compiles with ZERO errors**

---

## HARD RULES — DO NOT VIOLATE

1. **NEVER re-add deleted features.** No genesis hashing, no OpenTimestamps, no AI analysis queue, no XP system, no tiers (explorer/builder/architect/pioneer), no badges, no prior art claims, no peer reviews, no challenges, no protection levels (open/guarded/shielded/vault), no remix system, no justice engine, no IP protection. These are DEAD. If you feel something is "missing," check with the developer before adding it.

2. **Ideas MUST belong to a room.** No floating ideas. Every idea has a `roomId`. Solo ideas go in the user's personal room (auto-created on signup).

3. **Every user gets an auto-created personal room on signup.** This is handled in `app/actions/userActions.ts` → `createUserProfile()`. Do not remove this.

4. **Public rooms are join-with-one-click.** No request/approval flow for public rooms. Private rooms are invite-only.

5. **Room member limit is 2-8 people** (configurable via `maxMembers` column).

6. **Do NOT add Phase 2 features yet.** No projects table, no milestones, no task tracking, no AI analysis. Phase 2 comes AFTER rooms prove they work.

7. **Canonical primary color is `#0d9488` (teal).** Icon library is Lucide React. Dark theme (bg-slate-950).

8. **All new API routes require:** Clerk `auth()` guard, Zod validation, rate limiting via `writeLimiter` or `lightLimiter` from `lib/ratelimit.ts`.

9. **Do NOT generate `vercel.json` cron jobs** unless explicitly asked.

10. **Do NOT add Upstash Redis or Vercel KV.** Rate limiting is in-memory via `lib/ratelimit.ts`.

---

## Current Schema (db/schema.ts)

```
users          — id mod, name, handle, email, image, bio, avatarUrl
rooms          — id, name, description, category, coverImage, creatorId, visibility, maxMembers, status, pinnedIdeaId
roomMembers    — id, roomId, userId, role (owner/moderator/member)
roomInvites    — id, roomId, inviterId, inviteeId, inviteCode, status, expiresAt
ideas          — id, userId, roomId, title, context, content, category, tags[], status, totalLikes, totalComments, views
ideaComments   — id, ideaId, userId, content, parentId (threaded)
ideaLikes      — id, userId, ideaId (unique per user-idea)
follows        — id, followerId, followingId
notifications  — id, userId, type, body, link, read
reports        — id, reporterId, targetType, targetId, reportType, details, status, adminNote
bookmarks      — id, userId, targetType, targetId
```

---

## What Needs Building (Week 2)

### Priority 1: Room CRUD — `app/actions/roomActions.ts`
```
createRoom(formData)        — name, description, category, visibility
updateRoom(roomId, formData) — owner/mod only
archiveRoom(roomId)         — owner only
joinPublicRoom(roomId)      — one-click for public rooms
leaveRoom(roomId)           — any member
inviteMember(roomId, targetUserId) — owner/mod, sends notification
generateInviteLink(roomId)  — creates unique invite code
acceptInvite(inviteId)      — adds to roomMembers
declineInvite(inviteId)     — marks invite as declined
removeMember(roomId, userId) — owner/mod only
updateMemberRole(roomId, userId, newRole) — owner only
pinIdea(roomId, ideaId)     — owner/mod
getRoomWithMembers(roomId)  — returns room + member list
```

### Priority 2: Room Pages
```
/rooms/new           — create room form (name, description, category, visibility toggle)
/rooms/[roomId]      — room detail page (member list + ideas feed + "Post Idea" button)
/rooms/[roomId]/settings — room settings (owner/mod only)
/rooms/join/[code]   — accept invite link, redirect to room
/explore             — discover public rooms (sorted by members/activity)
```

### Priority 3: Room Components
```
components/RoomCard.tsx        — room preview card for listings
components/RoomHeader.tsx      — room banner with name, description, member count
components/RoomMemberList.tsx   — avatar stack + roles
components/RoomInviteModal.tsx  — search users + copy invite link
components/RoomSettingsForm.tsx — edit room, manage members
components/CreateRoomForm.tsx   — new room creation
components/JoinRoomButton.tsx   — one-click join for public rooms
components/RoomIdeasFeed.tsx    — ideas feed scoped to a room
```

---

## Navigation (Sidebar)

```
🏠 Home Feed     → /feed
🚀 My Rooms      → /dashboard
🔍 Explore       → /explore
📌 Bookmarks     → /bookmarks
✦  New Room      → /rooms/new
👤 My Profile    → /profile/[handle]
```

---

## Key Files to Understand

| File | Purpose |
|------|---------|
| `db/schema.ts` | All table definitions — START HERE |
| `app/actions/ideaActions.ts` | Room-scoped idea CRUD (already done) |
| `app/actions/userActions.ts` | User profile + auto-create personal room |
| `app/actions/socialActions.ts` | Follow/unfollow |
| `app/actions/notificationActions.ts` | Create/read notifications |
| `lib/auth.ts` | `getAuthenticatedUserId()`, `requireAuth()`, `isAdmin()` |
| `lib/ratelimit.ts` | In-memory rate limiter (`writeLimiter`, `lightLimiter`) |
| `lib/categories.ts` | Default idea categories |
| `middleware.ts` | Clerk auth middleware, public route matcher |
| `components/Sidebar.tsx` | Main navigation |
| `PHASE1_BLUEPRINT.md` | Full technical spec |

---

## Migration

The migration SQL is at `drizzle/0005_v15_rooms_pivot.sql`. Run it against your Neon database BEFORE testing locally:

```bash
# Option 1: Use Drizzle to push schema
npx drizzle-kit push

# Option 2: Run the SQL directly in Neon console
# Copy contents of drizzle/0005_v15_rooms_pivot.sql
```

---

## Testing Checklist (before building new features)

- [ ] `npm run dev` starts without errors
- [ ] Landing page (/) loads
- [ ] Sign-up → onboarding flow works
- [ ] Onboarding creates a personal room automatically
- [ ] /dashboard shows "My Rooms" (at least the personal room)
- [ ] /feed loads without crashing
- [ ] Posting an idea (in personal room) works
- [ ] Sparking an idea works
- [ ] Comments work
- [ ] Profile page loads and shows rooms

---

## Local Development Notes (Phase 2)

### Cron routes require non-Turbopack dev server on Windows
Turbopack (Next.js 16 default on Windows) does not route POST requests to `route.ts` API handlers correctly in local dev. All `/api/cron/agents/*` routes return 404 under Turbopack.

To test cron routes locally, start the dev server with:
```bash
next dev --turbopack=false
# or
next dev --no-turbopack
```

This only affects local Windows dev. The routes work correctly in Vercel production.

### NEXTAUTH_URL must be localhost in .env.local
`.env.local` must have `NEXTAUTH_URL=http://localhost:3099` (or whatever port you use).
Do NOT set it to the production Vercel URL — that causes all dev auth redirects to go to production.
The production URL belongs only in Vercel environment variables.
