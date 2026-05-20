# Multi-Round Debate — Phase 2 Spec
## IdeaConnect Phase 6

**Status:** Spec — approved, ready to build
**Depends on:** Phase 5 (Quick Debate) complete and content-quality verified

---

## What It Does

After a Round 1 debate archives, the user can push the agents into a second round via "Push back →". Round 2 forces Agent A to defend its original claim against Agent B's specific attack, and Agent B to respond to Agent A's defense. The Round 2 Archivist reports observable behavior — who shifted, who held ground, who failed to address a specific attack — and names a winner on the crux. Verdict is structured JSON, not prose parsing.

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
- `archivistSummary` — Round 1 crux summary (preserved, never overwritten)
- `shareToken` — set at Round 1 archive, carries through to Round 2
- `status` — `in_progress` during any round, `archived` when complete

`verdict_reasoning` = two-section Round 2 Archivist prose (who shifted/held/missed).
`verdict` = one-line winner statement with observable fact.

**No `context_summary` column in Phase 2.** At 4 turns × 150 words, there is no token problem. Add in Phase 3 only if rounds increase.

---

## Round 2 Trigger Flow

```
User clicks "Push back →" on /debates/[id] page
  → POST /api/debates/[id]/continue
      Auth check + own-debate check
      409 if debate.status !== "archived"
      429 if debate.round_count >= 2
      Set debates.status = 'in_progress', round_count = 2
      Insert debate_turn { debateId, slot: 0, round: 2, priority: 1 }
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

### `buildRound2TurnPrompt`

Single function, switches internally on `slot`. Consistent with how `buildDebateTurnPrompt` handles `isAgentB`.

```typescript
buildRound2TurnPrompt(args: {
  debate:           { originalInput: string; archivistSummary: string | null };
  agent:            { name: string; persona: string };
  slot:             0 | 1;
  round1AgentATurn: { content: string };
  round1AgentBTurn: { content: string };
  round2AgentATurn?: { content: string }; // only present when slot === 1
  agentAName:       string;
  agentBName:       string;
}): string
```

**Slot 0 (Agent A, Round 2):**
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

**Slot 1 (Agent B, Round 2):**
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

---

### `buildRound2ArchivePrompt`

Returns `{ systemPrompt, userPrompt }`. The system prompt stays minimal — do not put JSON instructions in the system prompt, only in the user prompt.

**System prompt:**
```
You summarize AI debates for public sharing.
Write for someone who was not in the debate.
```

**User prompt:**
```
ORIGINAL IDEA: "{debate.originalInput}"
CRUX FROM ROUND 1: "{debate.archivistSummary}"

ROUND 1:
{agentAName}: "{round1AgentATurn.content}"
{agentBName}: "{round1AgentBTurn.content}"

ROUND 2:
{agentAName}: "{round2AgentATurn.content}"
{agentBName}: "{round2AgentBTurn.content}"

Write two sections of plain prose (no section headers in prose):

SECTION 1 (~75 words): Who shifted and who held ground.
State observable facts only — what each agent actually did between Round 1 and
Round 2. Examples:
- "{agentAName} repeated their original claim without addressing {agentBName}'s
  counterexample about [X]."
- "{agentBName} conceded the [X] point and redirected to [Y]."
- "{agentAName} introduced [new example] in Round 2 that directly addresses
  {agentBName}'s Round 1 attack."
Do not say "more defensible" or "both raised valid points."

SECTION 2 (~75 words): Verdict.
Name a winner on the crux. Support it with one observable fact from the exchange
— something one agent did or failed to do that is visible in the turns above.
The winner is whoever held their position on the crux with new reasoning. If
neither agent addressed the crux in Round 2, say so explicitly and name the
exchange as unresolved.

Respond with this JSON only. No prose outside the JSON. No markdown fences.
{
  "verdict_reasoning": "~150 words of plain prose covering both sections",
  "verdict": "One sentence naming the winner on the crux with the observable fact that supports it. If unresolved, say so explicitly."
}
```

---

## Executor Changes

### `round` extraction (both handlers)

Round 1 queue items were inserted before `round` existed and have no `round` field in `promptContext`. Always extract with a typed default:

```typescript
const round = Number((ctx.round as number | undefined) ?? 1);
```

Not `Number(ctx.round ?? 1)` — the explicit type annotation is required to avoid TypeScript treating `undefined` ambiguously. Do NOT add `round: 1` to existing Round 1 queue inserts; the default handles them.

### `executeDebateTurn` (modified)

```
const round = Number((ctx.round as number | undefined) ?? 1);
const slot  = Number(ctx.slot ?? 0);
```

If `round === 2`: call `buildRound2TurnPrompt` instead of `buildDebateTurnPrompt`.
Fetch all four Round 1 turns (filter by `round === 1`, order by `createdAt`).

Chaining when `round === 2`:
- Slot 0 → insert `debate_turn { slot: 1, round: 2, priority: 1 }`
- Slot 1 → insert `debate_archive { debateId, round: 2 }` (priority: 1)

### `executeDebateArchive` (modified)

```
const round = Number((ctx.round as number | undefined) ?? 1);
```

If `round === 2`:
- Fetch all 4 turns (Round 1 × 2, Round 2 × 2), ordered by `createdAt`
- Call `buildRound2ArchivePrompt`
- Call `callGitHub("openai/gpt-4o-mini", systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 400 })`
- Call `parseJsonResponse` on the result (same utility used in judge route)
- Write `parsed.verdict_reasoning` → `debates.verdictReasoning`
- Write `parsed.verdict` → `debates.verdict`
- Set `debates.status = "archived"`, `debates.updatedAt = new Date()`
- Do NOT touch `archivistSummary` (Round 1 crux preserved)

If `round === 1` (default): behavior unchanged.

---

## New API Route

### `POST /api/debates/[id]/continue`

```typescript
export const maxDuration = 10;

// 1. Auth + parse debateId (Zod)
// 2. Load debate — 404 if not found or userId !== session.user.id
// 3. 409 if debate.status !== "archived"
// 4. 429 if debate.round_count >= 2
// 5. Load participants — 500 if none found
// 6. db.update(debates).set({ status: "in_progress", round_count: 2, updatedAt: new Date() })
// 7. db.insert(aiQueue) — debate_turn, slot: 0, round: 2, priority: 1
// 8. after(async () => { for (let i = 0; i < 4; i++) { const r = await processQueue(1).catch(() => ({ processed: 0 })); if (r.processed === 0) break; } })
// 9. return NextResponse.json({ status: "started", debateId })
```

---

## Status Route Changes

### `GET /api/debates/[id]/status`

Add to response: `round_count`, `verdict`, `verdict_reasoning`.
The DebatePoller calls `router.refresh()` on status change — no polling changes needed.

---

## UI Changes

### `/debates/[id]/page.tsx`

**When `status === "archived"` and `round_count < 2`:**
Show "Push back →" button below the Round 1 archive block. On click: POST `/api/debates/[id]/continue`, then resume DebatePoller (set `status` back to `in_progress` locally).

**When `round_count >= 2` and `status === "archived"`:**
- Round 1 turns (existing layout)
- Round 1 `archivistSummary` block (existing layout)
- Divider: "Round 2"
- Round 2 turns (same agent turn layout)
- `verdict_reasoning` block (plain prose, same styling as archivistSummary)
- `verdict` callout (distinct styling — single sentence, prominent)

### `/debates/share/[token]/page.tsx`

Extend with same Round 2 + verdict layout when `round_count >= 2`.

---

## DebatePoller

No changes to polling logic. After `/api/debates/[id]/continue` returns, the client sets debate status to `in_progress` and the existing DebatePoller loop picks up from there.

---

## File Map

| File | Change |
|------|--------|
| `drizzle/0009_multi_round.sql` | Migration: 4 new columns |
| `db/schema.ts` | Add 4 columns to `debates`, `round` to `debate_turns` |
| `lib/agents/prompts.ts` | Add `buildRound2TurnPrompt`, `buildRound2ArchivePrompt` |
| `lib/agents/executor.ts` | Modify `executeDebateTurn`, `executeDebateArchive` for round context |
| `app/api/debates/[id]/continue/route.ts` | New |
| `app/api/debates/[id]/status/route.ts` | Add `round_count`, `verdict`, `verdict_reasoning` |
| `app/debates/[id]/page.tsx` | Round 2 display + "Push back →" button |
| `app/debates/share/[token]/page.tsx` | Round 2 + verdict |
| `CLAUDE.md` | Phase 6 section |
| `docs/QUICK_DEBATE.md` | Link to this doc |

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

1. Migration SQL + schema update (`db/schema.ts`)
2. `buildRound2TurnPrompt` + `buildRound2ArchivePrompt` in `lib/agents/prompts.ts`
3. Executor: `executeDebateTurn` + `executeDebateArchive` round handling
4. `POST /api/debates/[id]/continue` route
5. `GET /api/debates/[id]/status` — add round fields
6. `/debates/[id]/page.tsx` — Round 2 UI + button
7. `/debates/share/[token]/page.tsx` — Round 2 + verdict
8. Integration test additions to `scripts/test-debate-flow.ts`
