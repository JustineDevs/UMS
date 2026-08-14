# Plugin capabilities — agent-hub

## Identity

- **Plugin**: agent-hub  
- **Role**: Route Claude Code (and compatible hosts) to the right documentation, command workflows, and specialist subagent profiles for orchestration-centric work in this repository.

## Supported capabilities

1. **Architecture navigation** — Point users and agents to `architecture/*.md` by layer (intent through release).
2. **Orchestration mapping** — Use `indexes/orchestration-map.md` to fill or validate layer status for a workspace.
3. **Command launch** — Reference `commands/*.md` for structured task prompts (purpose, read-first, output, guardrails, stop conditions).
4. **Subagent delegation** — Use `subagents/*.md` for specialist slices; use `commands/agent-hub.md` to choose command-only, skill-only, subagent-only, or combined routing.
5. **Agent operating rules** — Enforce `agent/editing-rules.md` and `agent/task-routing.md` before code edits.
6. **Inspection scaffolding** — Apply `templates/inspection-pass-template.md` for repeatable audits.
7. **Flow explanation** — Use `diagrams/*.md` for startup, delegation, memory, recovery, and permission flows.
8. **Package governance** — Point maintainers to `indexes/decisions-index.md` when hub scope or boundaries are unclear.

## Out of scope

- Defining vendor-specific product behavior not documented in this tree.
- Replacing runtime tests or CI.
- Auto-approving destructive edits without human gate when policy requires it.

## Doc authority

When plugin-assisted answers conflict with application source, **source wins for runtime**; **update docs** after verification.
