# Command index

## Canonical source

**Normative workflow specifications** live in **`agent-hub/commands/*.md`**. Everything else is optional packaging:

| Surface | Role |
|---------|------|
| **`commands/*.md`** | Canonical: purpose, read-first, output shape, guardrails, stop conditions |
| **`SKILL.md`** (package root) | Machine-readable entry: reading order, layer table, high-risk zones |
| **Editor launchers** | Optional: thin wrappers that point agents at the same workflows. May exist only in some workspace layouts. If a launcher disagrees with `commands/*.md`, **update the launcher**; do not fork workflow text long-term. |

**Naming:** Prefer the **`agent-hub-*`** prefixed launcher names when adding new editor commands, to avoid collisions with unrelated projects. Short-name mirrors (`architect.md`, `repo-map.md`, …) are **legacy aliases** for the same workflows.

---

Project-native command docs:

| Command doc | Purpose |
|-------------|---------|
| `commands/agent-hub.md` | Universal dispatcher: classify task, pick minimal route |
| `commands/map.md` | Fill orchestration layer table for workspace |
| `commands/architect.md` | Full architecture pass and phased plan |
| `commands/memory.md` | Memory pipeline design and review |
| `commands/recovery.md` | Resume, rewind, reconnect modes |
| `commands/verify.md` | Verification entry inventory |
| `commands/next-pass.md` | Prioritized next inspection targets |

## Specialist subagents (`subagents/`)

Narrow **worker profiles** (role, mission, read-first, outputs, guardrails, handoffs). They **link** into `architecture/`, `indexes/`, and `commands/` instead of replacing those trees.

| Subagent doc | Use |
|--------------|-----|
| `subagents/README.md` | Roster, separation from `agent/` and `commands/` |
| `subagents/architect.md` | System design and refactor planning slices |
| `subagents/repo-cartographer.md` | Path-to-responsibility maps and index refresh |
| `subagents/memory-auditor.md` | Memory pipelines and writer boundaries |
| `subagents/recovery-analyst.md` | Resume, rewind, reconnect semantics |
| `subagents/verification-auditor.md` | Quality gates and acceptance coverage |
| `subagents/command-router.md` | Pick routing mode (command / skill / subagent / combined) |

**Dispatcher:** `commands/agent-hub.md` defines routing modes and the rule to consider a specialist first for architecture-sensitive, multi-step, or domain-specific work.

## Optional editor launchers

This skill does **not** ship a `.cursor/` tree. If you use **Cursor**, add thin files under your **repository root** `.cursor/commands/` that point at `agent-hub/commands/*.md` (see **Adding a command**, step 3). Skill-only installs may have no `.cursor/` until you create it.

| Launcher (examples at repo root) | Purpose |
|----------|---------|
| `.cursor/commands/agent-hub.md` | Universal dispatcher |
| `.cursor/commands/agent-hub-map.md` or `repo-map.md` | Orchestration layer table |
| `.cursor/commands/agent-hub-architect.md` | Full architecture pass |
| `.cursor/commands/agent-hub-memory.md` | Memory pipelines |
| `.cursor/commands/agent-hub-recovery.md` | Recovery modes |
| `.cursor/commands/agent-hub-verify.md` | Verification inventory |
| `.cursor/commands/agent-hub-next-pass.md` | Next inspection targets |

### Legacy short-name mirrors (repo root only)

| Launcher | Maps to |
|----------|---------|
| `.cursor/commands/repo-map.md` | `commands/map.md` |
| `.cursor/commands/architect.md` | `commands/architect.md` |
| `.cursor/commands/memory.md` | `commands/memory.md` |
| `.cursor/commands/recovery.md` | `commands/recovery.md` |
| `.cursor/commands/verify.md` | `commands/verify.md` |
| `.cursor/commands/next-pass.md` | `commands/next-pass.md` |

## Adding a command

1. Add `commands/<name>.md` with sections: Purpose, When to use, Read first, Expected output, Guardrails, Stop conditions.  
2. Add a row here and in `agent/task-routing.md` if user-facing.  
3. If your environment supports it, add an optional editor launcher that references the same workflow (no duplicate normative prose). To generate **Cursor** launchers in bulk, use **`COMMANDS.md`** (paste-into-chat guide at package root).
