# Multi-Round Debate — Phase 2 Spec
## IdeaConnect Phase 6

**Status:** Spec — not yet built
**Depends on:** Phase 5 (Quick Debate) complete and content-quality verified

---

## What It Does

After a Round 1 debate archives, the user can push the agents into a second round via "Push back →". Round 2 forces Agent A to defend its original claim against Agent B's specific attack, and Agent B to respond to Agent A's defense. The Round 2 Archivist reports observable behavior — who shifted, who held ground, who failed to address a specific attack — and names a winner on the crux.

**Scope boundary:** Maximum 2 rounds in Phase 2. Round 3+ is Phase 3 after 2-round debates are validated.

---

## Schema Delta

```sql
-- Migration 0009
ALTER TABLE debate_turns ADD COLUMN round INTEGER NOT NULL DEFAULT 1;
ALTER TABLE debates ADD COLUMN round_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE debates ADD COLUMN verdict TEXT;
ALTER TABLE debates ADD COLUMN verdict_reasoning TEXT;
```

Existing columns unchanged:
- `archivistSummary` — Round 1 crux summary (preserved, not overwritten)
- `shareToken` — set at Round 1 archive, carries through to Round 2
- `status` — `in_progress` during any round, `archived` when complete

`verdict_reasoning` = full two-section Round 2 Archivist output (who shifted/held/missed).
`verdict` = one-line winner statement with observable fact.

**No `context_summary` column in Phase 2.** At 4 turns × 150 words, there is no token problem. Add in Phase 3 only if rounds increase.

---

## Round 2 Trigger Flow

```
User clicks "Push back →" on /debates/[id] page
  → POST /api/debates/[id]/continue
      Auth check + own-debate check
      round_count check: reject 429 if round_count >= 2
      Set debates.status = 'in_progress'
      Set debates.round_count = 2
      Insert debate_turn (round=2, slot=0, priority=1)
      Return { status: "started" }
      after() fires: processQueue(1) loop up to 4 passes
          Pass 1: Round 2 Agent A turn (~2-3s)
          Pass 2: Round 2 Agent B turn (~2-3s)
          Pass 3: Round 2 Archive + verdict (~1-2s)
  → DebatePoller resumes polling (same 10s interval, 15min timeout)
  → /debates/[id] page shows Round 2 turns + verdict when archived
```

---

## New Prompts

### `buildRound2TurnPrompt` — Agent A (Round 2, slot 0)

```
You are {agent.name} in Round 2 of a Quick Debate on IdeaConnect.

ORIGINAL IDEA: "{debate.originalInput}"

YOUR ROUND 1 ARGUMENT:
"{round1AgentATurn.content}"

{agentBName.toUpperCase()}'S ATTACK ON YOUR ARGUMENT:
"{round1AgentBTurn.content}"

You have ONE response. Choose one:
- DEFEND: Provide new reasoning that directly addresses {agentBName}'s specific
  attack. Do not repeat your Round 1 argument. Bring a new example, a named
  counterexample to their counterexample, or a logical flaw in their attack.
- CONCEDE AND REDIRECT: Explicitly acknowledge that {agentBName}'s attack is
  correct on this specific point. Then redirect to a different claim you ARE
  prepared to defend.

Do NOT do both. Pick one and commit to it.
Do NOT restate the original idea. Respond to what {agentBName} actually said.

Write 100–150 words.
{agent.persona}
```

### `buildRound2TurnPrompt` — Agent B (Round 2, slot 1)

```
You are {agent.name} in Round 2 of a Quick Debate on IdeaConnect.

ORIGINAL IDEA: "{debate.originalInput}"

YOUR ROUND 1 ARGUMENT:
"{round1AgentBTurn.content}"

{agentAName.toUpperCase()}'S ROUND 2 RESPONSE:
"{round2AgentATurn.content}"

Did {agentAName} defend their position with new reasoning, or did they concede
and redirect?

If they defended: attack the new reasoning directly. Do not re-litigate Round 1.
If they conceded and redirected: attack the new claim they redirected to.
Either way: name the specific thing they said in Round 2 before responding.

Write 100–150 words.
{agent.persona}
```

### `buildRound2ArchivePrompt`

System prompt (same minimal role-setting as Round 1):
```
You summarize AI debates for public sharing.
Write plain prose. No headers. No bullet points.
Write for someone who was not in the debate.
```

User prompt:
```
ORIGINAL IDEA: "{debate.originalInput}"
CRUX FROM ROUND 1: "{debate.archivistSummary}"

ROUND 1:
{agentAName}: "{round1AgentATurn.content}"
{agentBName}: "{round1AgentBTurn.content}"

ROUND 2:
{agentAName}: "{round2AgentATurn.content}"
{agentBName}: "{round2AgentBTurn.content}"

Write two sections of plain prose (no section headers):

SECTION 1 (~75 words): Who shifted and who held ground.
State observable facts only — what each agent actually did between Round 1
and Round 2. Examples of observable facts:
- "{agentAName} repeated their original claim without addressing {agentBName}'s
  counterexample about [X]."
- "{agentBName} conceded the [X] point and redirected to [Y]."
- "{agentAName} introduced [new example] in Round 2 that directly addresses
  {agentBName}'s Round 1 attack."
Do not say "more defensible" or "both raised valid points."

SECTION 2 (~75 words): Verdict.
Name a winner on the crux. Support it with one observable fact from the
exchange — something one agent did or failed to do that is visible in the
turns above. The winner is whoever held their position on the crux with
new reasoning. If neither agent addressed the crux in Round 2, say so
explicitly and name the exchange as unresolved.
```

---

## Executor Changes

### `executeDebateTurn` (modified)

Read `round` from `promptContext`. If `round === 2`, call `buildRound2TurnPrompt` instead of `buildDebateTurnPrompt`. Pass all four Round 1 turns.

When chaining Agent B (slot 1, round 2): insert `debate_turn` with `round=2`.
When chaining archive (after slot 1, round 2): insert `debate_archive` with `round=2` in `promptContext`.

### `executeDebateArchive` (modified)

Read `round` from `promptContext`. If `round === 2`:
- Use `buildRound2ArchivePrompt`
- Write result to `debates.verdict_reasoning` and extract one-line `verdict`
- Set `debates.status = 'archived'`, `debates.updatedAt`
- Do NOT overwrite `archivistSummary` (Round 1 crux must be preserved)

If `round === 1` (default): behavior unchanged.

---

## New API Route

### `POST /api/debates/[id]/continue`

```typescript
// Auth + ownership check
// Load debate — 404 if not found or not owned
// 409 if debate.status !== "archived"
// 429 if debate.round_count >= 2
// Load participants (for agent IDs)
// Set debates.status = 'in_progress', round_count = 2
// Insert debate_turn: { debateId, slot: 0, round: 2 }, priority: 1
// after(): processQueue(1) loop ×4
// Return { status: "started", debateId }
```

---

## UI Changes

### `/debates/[id]/page.tsx`

When `debate.status === "archived"` and `debate.round_count < 2`:
- Show "Push back →" button below the Round 1 archive block
- On click: POST `/api/debates/[id]/continue`, then resume DebatePoller

When `debate.round_count === 2` and archived:
- Show Round 1 turns + Round 1 archivistSummary block
- Show Round 2 turns below
- Show verdict_reasoning + verdict block (distinct styling)

### `/debates/share/[token]/page.tsx`

Same layout as the debate page. The share page already shows full content — extend it to show Round 2 turns and verdict when present.

---

## DebatePoller

No changes needed. The poller already polls `/api/debates/[id]/status` every 10s and calls `router.refresh()` when status changes. It will pick up Round 2 in-progress state and refresh when archived.

The `/api/debates/[id]/status` route needs to return `round_count`, `verdict`, and `verdict_reasoning` so the page can display them correctly.

---

## File Map (new/changed)

| File | Change |
|------|--------|
| `drizzle/0009_multi_round.sql` | Migration: 4 new columns |
| `db/schema.ts` | Add 4 columns to `debates`, `round` to `debate_turns` |
| `lib/agents/prompts.ts` | Add `buildRound2TurnPrompt`, `buildRound2ArchivePrompt` |
| `lib/agents/executor.ts` | Modify `executeDebateTurn`, `executeDebateArchive` for round context |
| `app/api/debates/[id]/continue/route.ts` | New: trigger Round 2 |
| `app/api/debates/[id]/status/route.ts` | Return `round_count`, `verdict`, `verdict_reasoning` |
| `app/debates/[id]/page.tsx` | Show Round 2 turns, verdict, "Push back →" button |
| `app/debates/share/[token]/page.tsx` | Show Round 2 turns and verdict |
| `CLAUDE.md` | Update Phase 6 section |
| `docs/QUICK_DEBATE.md` | Note multi-round as Phase 2, link to this doc |

---

## Out of Scope (Phase 3+)

- Round 3+ (requires context summary when turns exceed token budget)
- Auto-chaining Round 2 without user trigger
- Argument graph (`parent_turn_id`, `stance` fields)
- Personality overlays on agents
- Additional modes (Error Check, Devil's Advocate, Build Roadmap)
- Bridge statements / consensus points
- User-defined personas

---

## Build Order

1. Migration + schema update
2. `buildRound2TurnPrompt` + `buildRound2ArchivePrompt` in `prompts.ts`
3. Executor changes (`executeDebateTurn`, `executeDebateArchive`)
4. `POST /api/debates/[id]/continue` route
5. Status route: add `round_count`, `verdict`, `verdict_reasoning`
6. `/debates/[id]/page.tsx` UI (button + Round 2 display)
7. `/debates/share/[token]/page.tsx` UI (Round 2 + verdict)
8. Integration test additions to `scripts/test-debate-flow.ts`
