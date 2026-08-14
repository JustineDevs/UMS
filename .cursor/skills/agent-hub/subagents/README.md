# Specialist subagents

**Subagents** here are **narrow worker profiles**: what to load, how to answer, when to stop, and where to hand off. They are **not** a second copy of architecture text. They **route into** `architecture/`, `indexes/`, `commands/`, and `SKILL.md`.

## Separation of concerns

| Tree | Role |
|------|------|
| **`agent/`** | Global operating model, editing guardrails, task routing table. |
| **`subagents/`** | Scoped execution personas for delegated or focused work. |
| **`commands/`** | Repeatable workflows (what to run). |
| **`SKILL.md`** | Machine-readable package entry and layer index. |

## Roster

| File | Focus |
|------|--------|
| `architect.md` | System design, boundaries, structure, refactor planning. |
| `repo-cartographer.md` | Index the repo, map files to responsibilities, refresh navigation docs. |
| `memory-auditor.md` | Memory layers, triggers, writer boundaries, confusion risks. |
| `recovery-analyst.md` | Resume, rewind, reconnect, recovery semantics. |
| `verification-auditor.md` | Tests, validation, quality gates, acceptance coverage. |
| `command-router.md` | Choose command-only, skill-only, subagent-only, or combined routing. |

## Dispatching

Hosts that support multiple surfaces should use **`commands/agent-hub.md`** as the universal dispatcher. It defines routing modes and when to assign a specialist **before** defaulting to a single agent or a single command path.

## Rules

- One primary subagent per delegated slice; merge only via explicit handoff sections.
- Do not duplicate full layer docs; link and summarize.
- After changing behavior in application code, update the relevant `architecture/*.md` and indexes, not only subagent prose.
