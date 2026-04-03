# IdeaConnect Phase 1 Blueprint — "Rooms First" MVP

**Date:** April 3, 2026
**Version:** v15 (pivot)
**Codename:** IdeaConnect Rooms

---

## 1. PRODUCT IDENTITY (POST-PIVOT)

**One-liner:** IdeaConnect is where small teams brainstorm, refine, and ship ideas together.

**Core loop:** Create Room → Invite People → Post Structured Ideas → Discuss & Refine → Graduate to Project (Phase 2)

**What IdeaConnect is NOT anymore:** An IP protection tool. A genesis hashing platform. A prior art registry.

**Target user for Phase 1:** Indie hackers, student project groups, and early-stage founders (teams of 2-8) who need a dedicated space to develop ideas — more structured than Discord, simpler than Notion.

---

## 2. KILL LIST — Files & Features to Remove

### Tables to DROP (migration required)
```
genesisHashes        → entire table
xpEvents             → entire table
challenges           → entire table
challengeSubmissions → entire table
priorArtClaims       → entire table
aiQueue              → entire table
reviews              → entire table
```

### Schema columns to DROP from `ideas`
```
ideas.ipProtected
ideas.genesisHash
ideas.aiMetadata
ideas.aiSummary
ideas.aiStatus
ideas.aiQueuedAt
ideas.editorsPick
ideas.remixedFromId
```

### Schema columns to DROP from `users`
```
users.privateXp
users.publicXp
users.tier
users.badges
users.allowRemix
users.pinnedIdeaIds
```

### Files to DELETE entirely

```
# Genesis / IP protection
lib/genesis-hash.ts
lib/genesis-hash-pipeline.ts
lib/open-timestamps.ts
lib/hash.ts
lib/simhash.ts

# AI analysis
lib/ai.ts
lib/scoreIdea.ts
components/ideas/AIAnalysisModal.tsx

# Justice / audit system
lib/justice-engine.ts
lib/justice-types.ts
lib/justice-cache.ts

# Tier / badge / gamification
lib/tier-engine.ts
lib/badge-engine.ts
lib/xp.ts
lib/feed-score.ts
lib/idea-of-the-day.ts
lib/flair.ts
components/BadgeDisplay.tsx
components/FlairBadge.tsx
components/FlairPicker.tsx
components/IdeaOfTheDay.tsx
components/PeerReviewBanner.tsx
components/PeerReviewList.tsx
components/PriorArtFilingButton.tsx
components/PriorArtTab.tsx
components/AetherFilter.tsx
components/DraftingLab.tsx
components/HangarActions.tsx
components/CommentWithReview.tsx

# Actions to delete
app/actions/badgeActions.ts
app/actions/justiceActions.ts
app/actions/priorArtActions.ts
app/actions/reviewActions.ts
app/actions/visionActions.ts

# API routes to delete
app/api/genesis/             (entire folder)
app/api/cron/ots-confirm/    (entire folder)
app/api/cron/leaderboard/    (entire folder)
app/api/queue/               (entire folder)

# Pages to delete
app/registry/                (entire folder)
app/leaderboard/             (entire folder)
```

### Files to HEAVILY REWRITE
```
db/schema.ts                → new schema (see Section 4)
app/actions/ideaActions.ts   → remove genesis hash, tier checks, XP, remix
app/actions/socialActions.ts → add room membership logic
app/page.tsx                 → new landing page messaging
components/Sidebar.tsx       → new nav (Rooms, My Projects, Explore, New Room)
components/IdeaCard.tsx      → room-aware idea cards
components/IdeaForm.tsx      → room-scoped idea submission
components/IdeaDetailClient.tsx → remove protection UI, add room context
app/feed/page.tsx            → becomes room discovery / activity feed
app/dashboard/page.tsx       → becomes "My Rooms + My Ideas" view
middleware.ts                → update public routes
```

---

## 3. WHAT STAYS (with minor edits)

| File/Module | Why it stays |
|---|---|
| Clerk auth (middleware, lib/auth.ts) | Rock solid, no changes needed |
| db/index.ts (Drizzle + Postgres) | Infrastructure stays |
| lib/ratelimit.ts | In-memory limiter still needed |
| lib/utils.ts | Utility functions |
| lib/categories.ts | Repurpose as default room categories |
| lib/jsonb.ts | Still useful for metadata columns |
| users table (trimmed) | Core identity |
| ideas table (trimmed) | Core content — now scoped to rooms |
| ideaComments table | Discussion stays |
| ideaLikes table | "Sparks" stay as idea upvotes |
| follows table | Social graph stays |
| notifications table | Notification system stays |
| reports table | Moderation stays |
| components/CommentsSection.tsx | Reuse for room discussions |
| components/SparkButton.tsx | Keep as upvote mechanism |
| components/FollowButton.tsx | Keep for user follows |
| components/NotificationCenter.tsx | Keep |
| components/Sidebar.tsx | Rewrite nav items, keep structure |
| components/IdeaCardSkeleton.tsx | Keep loading states |
| components/GlobalErrorBoundary.tsx | Keep |
| components/LoadingScreen.tsx | Keep |
| components/RegistrySearchTabs.tsx | Repurpose as Room search |
| app/actions/commentActions.ts | Keep (remove review references) |
| app/actions/notificationActions.ts | Keep |
| app/actions/userActions.ts | Keep (remove badge/tier refs) |
| app/actions/socialActions.ts | Keep + extend for room membership |
| app/actions/bookmarkActions.ts | Keep |
| app/profile/ | Keep user profiles |
| app/onboarding/ | Keep (update copy) |
| app/sign-in, app/sign-up | Keep |
| app/bookmarks/ | Keep |
| app/notifications/ | Keep |
| app/admin/ | Keep (update for room moderation) |

---

## 4. NEW SCHEMA

```typescript
// db/schema.ts — v15 (Rooms Pivot)

import {
  pgTable, text, timestamp, integer, uuid,
  uniqueIndex, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── USERS (trimmed) ─────────────────────────────────────────────────
export const users = pgTable("users", {
  id:        text("id").primaryKey(),              // Clerk user ID
  name:      text("name"),
  handle:    text("handle").unique(),
  email:     text("email").notNull(),
  image:     text("image"),
  bio:       text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── ROOMS ───────────────────────────────────────────────────────────
// A room is a collaborative space for 2-8 people to develop ideas.
export const rooms = pgTable("rooms", {
  id:          uuid("id").defaultRandom().primaryKey(),
  name:        text("name").notNull(),               // "AI for Agriculture"
  description: text("description"),                   // what this room is about
  category:    text("category"),                      // user-defined or default
  coverImage:  text("cover_image"),                   // optional banner
  creatorId:   text("creator_id").notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
  visibility:  text("visibility").default("private").notNull(),
                 // "private" = invite-only, "public" = discoverable
  maxMembers:  integer("max_members").default(8).notNull(),
  status:      text("status").default("active").notNull(),
                 // "active" | "archived"
  pinnedIdeaId: uuid("pinned_idea_id"),              // room's featured idea
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

// ─── ROOM MEMBERS ────────────────────────────────────────────────────
export const roomMembers = pgTable("room_members", {
  id:       uuid("id").defaultRandom().primaryKey(),
  roomId:   uuid("room_id").notNull()
              .references(() => rooms.id, { onDelete: "cascade" }),
  userId:   text("user_id").notNull()
              .references(() => users.id, { onDelete: "cascade" }),
  role:     text("role").default("member").notNull(),
              // "owner" | "moderator" | "member"
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  uniqueMembership: uniqueIndex("unique_room_member")
    .on(table.roomId, table.userId),
}));

// ─── ROOM INVITES ────────────────────────────────────────────────────
export const roomInvites = pgTable("room_invites", {
  id:        uuid("id").defaultRandom().primaryKey(),
  roomId:    uuid("room_id").notNull()
               .references(() => rooms.id, { onDelete: "cascade" }),
  inviterId: text("inviter_id").notNull()
               .references(() => users.id, { onDelete: "cascade" }),
  inviteeId: text("invitee_id")
               .references(() => users.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").unique(),           // for link-based invites
  status:    text("status").default("pending").notNull(),
               // "pending" | "accepted" | "declined" | "expired"
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// ─── IDEAS (trimmed + room-scoped) ──────────────────────────────────
// An idea now lives inside a room. Solo ideas go in user's personal room.
export const ideas = pgTable("ideas", {
  id:            uuid("id").defaultRandom().primaryKey(),
  userId:        text("user_id")
                   .references(() => users.id, { onDelete: "set null" }),
  roomId:        uuid("room_id")
                   .references(() => rooms.id, { onDelete: "cascade" }),
  title:         text("title").notNull(),
  context:       text("context"),                     // brief pitch / subtitle
  content:       text("content"),                     // full body (rich text)
  category:      text("category"),                    // inherits from room or custom
  tags:          text("tags").array().notNull()
                   .default(sql`ARRAY[]::text[]`),
  status:        text("status").default("draft").notNull(),
                   // "draft" | "published" | "archived"
  totalLikes:    integer("total_likes").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  views:         integer("views").default(0).notNull(),
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ─── IDEA COMMENTS (unchanged) ──────────────────────────────────────
export const ideaComments = pgTable("idea_comments", {
  id:        uuid("id").defaultRandom().primaryKey(),
  ideaId:    uuid("idea_id").notNull()
               .references(() => ideas.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull()
               .references(() => users.id, { onDelete: "cascade" }),
  content:   text("content").notNull(),
  parentId:  uuid("parent_id")
               .references((): any => ideaComments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── IDEA LIKES (unchanged) ─────────────────────────────────────────
export const ideaLikes = pgTable("idea_likes", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    text("user_id").notNull()
               .references(() => users.id, { onDelete: "cascade" }),
  ideaId:    uuid("idea_id").notNull()
               .references(() => ideas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueIdeaLike: uniqueIndex("unique_user_idea_like")
    .on(table.userId, table.ideaId),
}));

// ─── FOLLOWS (unchanged) ────────────────────────────────────────────
export const follows = pgTable("follows", {
  id:          uuid("id").defaultRandom().primaryKey(),
  followerId:  text("follower_id").notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
  createdAt:   timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueFollow: uniqueIndex("unique_follow")
    .on(table.followerId, table.followingId),
}));

// ─── NOTIFICATIONS (unchanged) ──────────────────────────────────────
export const notifications = pgTable("notifications", {
  id:            uuid("id").defaultRandom().primaryKey(),
  userId:        text("user_id").notNull()
                   .references(() => users.id, { onDelete: "cascade" }),
  type:          text("type").notNull(),
  body:          text("body").notNull(),
  link:          text("link"),
  read:          boolean("read").default(false).notNull(),
  createdAt:     timestamp("created_at").defaultNow(),
});

// ─── REPORTS (simplified) ───────────────────────────────────────────
export const reports = pgTable("reports", {
  id:          uuid("id").defaultRandom().primaryKey(),
  reporterId:  text("reporter_id").notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
  targetType:  text("target_type").notNull(),          // "room" | "idea" | "comment" | "user"
  targetId:    text("target_id").notNull(),
  reportType:  text("report_type").notNull(),           // "spam" | "harassment" | "off-topic"
  details:     text("details"),
  status:      text("status").default("pending").notNull(),
  adminNote:   text("admin_note"),
  createdAt:   timestamp("created_at").defaultNow(),
});

// ─── BOOKMARKS (for ideas and rooms) ────────────────────────────────
export const bookmarks = pgTable("bookmarks", {
  id:         uuid("id").defaultRandom().primaryKey(),
  userId:     text("user_id").notNull()
                .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),            // "idea" | "room"
  targetId:   text("target_id").notNull(),
  createdAt:  timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueBookmark: uniqueIndex("unique_bookmark")
    .on(table.userId, table.targetType, table.targetId),
}));
```

**Total tables: 10** (down from 14 + priorArtClaims = 15)

---

## 5. NEW NAVIGATION

```
Sidebar (authenticated):
  🏠  Home Feed          → /feed         (activity from your rooms + public rooms)
  🚀  My Rooms           → /rooms        (rooms you own or belong to)
  🔍  Explore            → /explore      (discover public rooms)
  📌  Bookmarks          → /bookmarks    (saved ideas and rooms)
  👤  Profile            → /profile/[handle]
  ✦   New Room           → /rooms/new    (create a room)
```

**Pages REMOVED from nav:** Registry, Leaderboard, My Workspace (replaced by My Rooms)

**New routes:**
```
/rooms                  → list user's rooms
/rooms/new              → create room form
/rooms/[roomId]         → room detail (member list + ideas feed)
/rooms/[roomId]/ideas   → all ideas in room
/rooms/[roomId]/settings → room settings (owner/mod only)
/rooms/join/[code]      → accept invite link
/explore                → discover public rooms
```

**Removed routes:**
```
/registry
/leaderboard
/dashboard/studio
/new                    → replaced by posting inside a room
```

---

## 6. CORE USER FLOWS

### Flow 1: Create a Room
1. User clicks "New Room" in sidebar
2. Fills in: name, description, category (pick from defaults or type custom), visibility (private/public)
3. Room is created, user is auto-added as "owner"
4. Shown the empty room page with an invite button + "Post your first idea" prompt

### Flow 2: Invite Members
1. Room owner/mod clicks "Invite" button
2. Two options:
   a. Search by handle → sends in-app notification invite
   b. Copy invite link → generates a unique code URL (/rooms/join/[code])
3. Invitee receives notification → clicks to accept/decline
4. On accept → added to roomMembers with role "member"

### Flow 3: Post an Idea in a Room
1. Inside a room, member clicks "New Idea"
2. Fills in: title, context (pitch), content (full body), tags
3. Idea is created with roomId set and status "published"
4. All room members see it in the room's idea feed
5. Members can comment and spark (upvote)

### Flow 4: Discover Rooms
1. User goes to /explore
2. Sees public rooms sorted by member count and recent activity
3. Can filter by category
4. Clicks a room → sees description + public ideas
5. Clicks "Join" → immediately added as member (public rooms)

### Flow 5: Solo Ideas
1. Every user gets an auto-created personal room (visibility: private, name: "@handle's workspace")
2. Ideas posted here are private/solo by default
3. User can move ideas between rooms later

---

## 7. MIGRATION STRATEGY

### Step 1: Create migration file
```sql
-- drizzle/0005_v15_rooms_pivot.sql

-- NEW TABLES
CREATE TABLE rooms ( ... );
CREATE TABLE room_members ( ... );
CREATE TABLE room_invites ( ... );

-- CREATE personal rooms for all existing users
INSERT INTO rooms (id, name, description, creator_id, visibility, status)
SELECT
  gen_random_uuid(),
  '@' || handle || '''s workspace',
  'Personal idea workspace',
  id,
  'private',
  'active'
FROM users WHERE handle IS NOT NULL;

-- Add room_id column to ideas (nullable initially)
ALTER TABLE ideas ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;

-- Migrate existing ideas into their creator's personal room
UPDATE ideas SET room_id = (
  SELECT r.id FROM rooms r WHERE r.creator_id = ideas.user_id LIMIT 1
) WHERE user_id IS NOT NULL;

-- COLUMNS TO DROP from ideas
ALTER TABLE ideas DROP COLUMN IF EXISTS ip_protected;
ALTER TABLE ideas DROP COLUMN IF EXISTS genesis_hash;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_metadata;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_summary;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_status;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_queued_at;
ALTER TABLE ideas DROP COLUMN IF EXISTS editors_pick;
ALTER TABLE ideas DROP COLUMN IF EXISTS remixed_from_id;
ALTER TABLE ideas DROP COLUMN IF EXISTS domain;

-- COLUMNS TO DROP from users
ALTER TABLE users DROP COLUMN IF EXISTS private_xp;
ALTER TABLE users DROP COLUMN IF EXISTS public_xp;
ALTER TABLE users DROP COLUMN IF EXISTS xp;
ALTER TABLE users DROP COLUMN IF EXISTS tier;
ALTER TABLE users DROP COLUMN IF EXISTS badges;
ALTER TABLE users DROP COLUMN IF EXISTS allow_remix;
ALTER TABLE users DROP COLUMN IF EXISTS pinned_idea_ids;

-- COLUMNS TO DROP/SIMPLIFY from notifications
ALTER TABLE notifications DROP COLUMN IF EXISTS domain;
ALTER TABLE notifications DROP COLUMN IF EXISTS actionable;
ALTER TABLE notifications DROP COLUMN IF EXISTS action_payload;

-- TABLES TO DROP
DROP TABLE IF EXISTS prior_art_claims;
DROP TABLE IF EXISTS challenge_submissions;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS xp_events;
DROP TABLE IF EXISTS genesis_hashes;
DROP TABLE IF EXISTS ai_queue;
DROP TABLE IF EXISTS reviews;

-- Add owner to room_members for each personal room
INSERT INTO room_members (id, room_id, user_id, role)
SELECT
  gen_random_uuid(),
  r.id,
  r.creator_id,
  'owner'
FROM rooms r;

-- MODIFY bookmarks to support rooms
-- (if bookmarks table exists with different structure, adapt)
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'idea';
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS target_id TEXT;

-- MODIFY reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'idea';
ALTER TABLE reports RENAME COLUMN domain TO target_type_old;
-- (handle data migration for reports if needed)
```

### Step 2: Run migration
```bash
npx drizzle-kit push
```

### Step 3: Verify data integrity
- All existing ideas have a room_id
- All users have a personal room
- All personal rooms have an owner in room_members

---

## 8. NEW SERVER ACTIONS NEEDED

```
app/actions/roomActions.ts
  ├── createRoom(formData)
  ├── updateRoom(roomId, formData)
  ├── deleteRoom(roomId)           // owner only
  ├── archiveRoom(roomId)          // owner/mod
  ├── joinPublicRoom(roomId)
  ├── leaveRoom(roomId)
  ├── inviteMember(roomId, targetUserId)
  ├── generateInviteLink(roomId)
  ├── acceptInvite(inviteId)
  ├── declineInvite(inviteId)
  ├── removeMember(roomId, userId)  // owner/mod
  ├── updateMemberRole(roomId, userId, newRole) // owner only
  ├── pinIdea(roomId, ideaId)      // owner/mod
  └── getRoomWithMembers(roomId)

app/actions/ideaActions.ts (REWRITTEN)
  ├── addIdea(roomId, formData)    // room-scoped
  ├── updateIdea(ideaId, formData)
  ├── deleteIdea(ideaId)
  ├── publishIdea(ideaId)          // simplified from launchIdea
  ├── sparkIdea(ideaId)            // keep, remove XP
  ├── recordView(ideaId)           // keep
  └── moveIdea(ideaId, newRoomId)  // move between rooms

app/actions/commentActions.ts (SIMPLIFIED)
  ├── addComment(ideaId, content, parentId?)
  ├── deleteComment(commentId)
  └── (remove review-related logic)
```

---

## 9. NEW COMPONENTS NEEDED

```
components/
  ├── RoomCard.tsx              → room preview card for explore/listing
  ├── RoomHeader.tsx            → room banner with name, description, members
  ├── RoomMemberList.tsx        → avatar stack + roles
  ├── RoomInviteModal.tsx       → search users + copy invite link
  ├── RoomSettingsForm.tsx      → edit room details, manage members
  ├── CreateRoomForm.tsx        → new room creation form
  ├── JoinRoomButton.tsx        → for public rooms
  ├── RoomIdeasFeed.tsx         → ideas feed scoped to a room
  ├── IdeaCard.tsx              → REWRITE: show room badge, remove protection UI
  ├── IdeaForm.tsx              → REWRITE: room-scoped, no domain/protection
  ├── IdeaDetailClient.tsx      → REWRITE: room context, no genesis/protection
  └── Sidebar.tsx               → REWRITE: new nav items
```

---

## 10. LANDING PAGE MESSAGING (NEW)

**Hero:**
> **Build Ideas Together.**
> IdeaConnect is where small teams brainstorm, refine, and build — in rooms designed for collaborative thinking.

**How it Works:**
1. Create a Room — Pick a topic, invite your team
2. Post Ideas — Structured posts with title, pitch, and full writeup
3. Discuss & Refine — Your team sparks, comments, and iterates
4. (Phase 2 teaser) Ship It — Graduate your best ideas into projects

**Remove:** All references to SHA-256, Genesis Hash, IP protection, prior art, "protect your ideas", fake social proof stats.

---

## 11. WHAT PHASE 2 LOOKS LIKE (DO NOT BUILD YET)

For context only — this is what comes AFTER Phase 1 proves rooms work:

- **Projects table:** An idea graduates to a project with milestones, open roles, status
- **Project members:** separate from room members (someone can be in the room but not on the project)
- **Milestone tracking:** lightweight task/milestone system
- **AI analysis:** Bring Groq back to analyze project viability (not individual ideas)
- **Public project discovery:** a feed of projects looking for collaborators

---

## 12. IMPLEMENTATION ORDER

**Week 1: Schema + Kill**
- [ ] Write and test the v15 migration SQL
- [ ] Delete all files on the kill list
- [ ] Update schema.ts with new tables
- [ ] Fix all TypeScript errors from deletions (expect ~50+)
- [ ] Verify build passes

**Week 2: Rooms Core**
- [ ] roomActions.ts — create, join, leave, invite
- [ ] /rooms/new page — create room form
- [ ] /rooms page — list user's rooms
- [ ] /rooms/[roomId] page — room detail with ideas feed
- [ ] Auto-create personal room on user signup/onboarding

**Week 3: Ideas in Rooms**
- [ ] Rewrite ideaActions.ts — room-scoped
- [ ] Rewrite IdeaForm.tsx — post inside a room
- [ ] Rewrite IdeaCard.tsx — show room badge
- [ ] Rewrite IdeaDetailClient.tsx — room context
- [ ] Comment system cleanup (remove review refs)

**Week 4: Invites + Discovery + Polish**
- [ ] Invite system (in-app + link-based)
- [ ] /explore page — discover public rooms
- [ ] New landing page copy
- [ ] Updated Sidebar navigation
- [ ] Notification updates for room events
- [ ] Mobile responsiveness pass

---

## 13. SUCCESS METRICS (Phase 1)

Before building Phase 2, these must be true:
- At least 10 rooms created organically (not by you)
- At least 3 rooms with 3+ active members
- At least 50 ideas posted across rooms
- Users returning to rooms within 7 days
- At least 1 room where members post ideas without your prompting

If these aren't hit within 6 weeks of launch, the pivot needs re-evaluation before adding Phase 2 complexity.

---

## 14. RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|---|---|---|
| Empty rooms kill engagement | HIGH | Auto-create personal rooms; seed 3-5 public rooms with real content on launch |
| Invite friction (users don't know who to invite) | MEDIUM | Public rooms as default; "Join" is one click; invite links are shareable |
| Feature regression complaints from existing users | LOW | Current user base is near-zero; clean break is fine |
| Solo users have no reason to stay | HIGH | Personal room serves as private idea journal; explore feed shows interesting public rooms |
| Scope creep back toward "one more feature" | HIGH | This document is the spec. If it's not in Weeks 1-4, it doesn't exist until Phase 2. |
