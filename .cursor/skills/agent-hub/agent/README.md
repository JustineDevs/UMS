# Agent guidance — agent-hub

This folder defines **how autonomous agents should operate** when using **agent-hub** as the orchestration canon.

## Contents

| File | Use |
|------|-----|
| `operating-model.md` | Task classification, routes, minimal context policy |
| `editing-rules.md` | Preconditions and stop conditions before edits |
| `task-routing.md` | Map user intents to docs and commands |

## Relationship to other trees

- **`architecture/`** — Layer definitions and boundaries (what the system should respect).
- **`commands/`** — Normative workflow specs; copy-paste or host-driven launchers tied to those layers.
- **`subagents/`** — Specialist worker profiles for delegated slices; use `commands/agent-hub.md` to choose modes.
- **`SKILL.md`** (package root) — Canonical machine-readable summary for skill-capable hosts.
- **`indexes/command-index.md`** — Canonical source ladder (`commands/` vs `SKILL.md` vs optional editor wrappers).

## First actions on any task

1. Classify the task using `operating-model.md`.
2. Open **one** primary architecture doc unless the task is a full audit.
3. If editing code outside `agent-hub/`, follow `editing-rules.md`.
