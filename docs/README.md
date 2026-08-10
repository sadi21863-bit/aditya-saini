# IdeaConnect — Documentation Index

Feature and operations documentation. Root `README.md` covers architecture overview and project structure. `CLAUDE.md` is the current-state reference for Claude Code sessions.

---

## Feature Docs

| File | What it covers |
|------|---------------|
| [ROOMS.md](ROOMS.md) | Room CRUD, roles, invites, personal room, visibility rules |
| [AI_LAB.md](AI_LAB.md) | Daily cycle, 9 agents, two-pass archive, Conductor, Research layer, self-healing |
| [MENTION_SYSTEM.md](MENTION_SYSTEM.md) | @mention flow, 4-layer privacy isolation, lab discussion echo |
| [QUICK_DEBATE.md](QUICK_DEBATE.md) | Judge routing, debate turns, archive, share link, rate limits, multi-round debates, pushback, verdict |

## Operations

| File | What it covers |
|------|---------------|
| [OPERATIONS.md](OPERATIONS.md) | Env vars, cron schedule, agent limits, diagnostics, deployment, MD update policy |
| [SCHEMA_NOTES.md](SCHEMA_NOTES.md) | Tables with no call sites, FK constraints, archive column types, Quick Debate table details |

## Historical

| File | What it covers |
|------|---------------|
| [BEFORE_LAUNCH.md](BEFORE_LAUNCH.md) | Pre-launch checklist (completed items + remaining open items) |
| [PHASE1_BLUEPRINT.md](PHASE1_BLUEPRINT.md) | Original Phase 1 rooms platform spec |
| [PHASE2_AI_LAB_SPEC_v4.2.md](PHASE2_AI_LAB_SPEC_v4.2.md) | AI Lab implementation spec |

---

## MD Update Policy

Every commit that changes code must update relevant docs before pushing. See [OPERATIONS.md](OPERATIONS.md#md-file-update-policy) for the full table of which files to update per change type.
