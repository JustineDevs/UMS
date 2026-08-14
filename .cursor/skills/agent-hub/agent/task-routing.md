# Task routing

Map **user intent** → **launcher** → **canonical doc** (optional **specialist** in `subagents/`).

| User says | Launcher | Canonical doc | Optional specialist |
|-----------|----------|----------------|---------------------|
| “Audit orchestration” | `commands/architect.md` | `indexes/orchestration-map.md` + layer docs | `subagents/architect.md` |
| “Map layers only” | `commands/map.md` | `indexes/orchestration-map.md` | `subagents/repo-cartographer.md` |
| “Memory design” | `commands/memory.md` | `architecture/08-memory-pipelines.md` | `subagents/memory-auditor.md` |
| “Resume / rewind” | `commands/recovery.md` | `architecture/09-recovery-and-resume.md` | `subagents/recovery-analyst.md` |
| “Tests / quality gates” | `commands/verify.md` | `architecture/07-verification-and-reflection.md` | `subagents/verification-auditor.md` |
| “Next files to read” | `commands/next-pass.md` | `templates/inspection-pass-template.md` | `subagents/repo-cartographer.md` |
| “Dispatcher / how to route” | `commands/agent-hub.md` | `SKILL.md` + this table | `subagents/command-router.md` |

If a task is architecture-sensitive, multi-step, or domain-specific, run `commands/agent-hub.md` and consider a specialist **before** collapsing work into one generic path.

## Cursor vs project commands

- **Project-native specs**: `agent-hub/commands/*.md` (versioned with the hub).
- **Editor launchers**: `.cursor/commands/*.md` at repo root (thin wrappers; may point here).

## Conflicts

If a launcher and an architecture doc disagree, **architecture doc wins**; update the launcher in the same PR.
