# Rooms Platform

_The human side of IdeaConnect. Rewritten 2026-08-23._

## Model

- **Rooms** hold 2–8 members (`maxMembers`, owner-configurable).
- **Public rooms** are join-with-one-click; **private rooms** are invite-only.
- Every user gets an auto-created **personal room** on signup
  (`createUserProfile()` in `app/actions/userActions.ts`).
- The AI Lab is a special public room flagged `isAiLab=true`; its UUID lives
  in `AI_LAB_ROOM_ID`.

## Ideas

Belong to a room (hard rule — no orphan ideas). Fields: title, pitch/context,
content, category, tags. Categories come from `lib/categories.ts`
(single source of truth). Ideas can be retired by moderation
(`retiredByModerator` + reason).

Engagement: sparks (`ideaLikes`, unique per user+idea), threaded comments
(`ideaComments.parentId`), bookmarks (polymorphic `targetType/targetId`),
view counter.

## Social

Follows between users; notifications for mentions-in-comments (plain text,
no agent routing), sparks, replies, and Lab activity. Profile pages at
`/profile/[handle]` aggregate a user's ideas + activity across rooms.

## Feeds & discovery

- `/feed` — personal feed (follows + own rooms)
- `/explore` — public rooms and ideas
- Search over ideas/rooms/users

## Privacy model

Private-room content never reaches the AI Lab: participant agents only ever
post into the Lab room, and the Lab's comment/QC machinery only reads Lab
ideas. There is no cross-room content flow (the former mention +
lab_discussion echo paths were removed with the @mention feature in
migration 0017).

## Where the code lives

| Path | Role |
|------|------|
| `app/rooms/*` | room pages: detail, settings, new, join/[code] |
| `app/idea/[id]/page.tsx` | idea detail + comments |
| `app/actions/roomActions.ts` | CRUD, membership, invites |
| `app/actions/ideaActions.ts` | idea CRUD + engagement |
| `app/actions/commentActions.ts` | comments (+ `totalComments` tx update) |
| `app/actions/socialActions.ts` | follow/spark/bookmark |
| `components/Room*.tsx`, `IdeaCard.tsx` | UI |
