# Orchestration map

Status values: **present**, **partial**, **missing**. This table describes the **agent-hub package** as shipped under `agent-hub/` (documentation control plane). It is **not** a runtime product map unless you extend it while auditing another application repository.

| Layer | Doc | Status | Evidence paths | Notes |
|-------|-----|--------|----------------|-------|
| Intent | `architecture/01-intent-and-commands.md` | present | `commands/`, `subagents/`, `SKILL.md`, `agent/task-routing.md` | Doc-native commands, dispatcher (`commands/agent-hub.md`), specialist profiles; no executable registry in this package |
| Policy | `architecture/02-policy-and-permissions.md` | present | `architecture/02-policy-and-permissions.md` | Canon for how to reason about policy layers in target apps |
| Context / state | `architecture/03-context-and-state.md` | partial | `architecture/03-context-and-state.md` | Strong guidance; no live state hub in this package |
| Planning / routing | `architecture/04-planning-and-routing.md` | present | `architecture/04-…`, `agent/operating-model.md`, `commands/agent-hub.md`, `subagents/command-router.md`, `diagrams/delegation-flow.md` | Task classes A–J routed to layer docs; dispatcher picks command / skill / subagent modes |
| Delegation / execution | `architecture/05-delegation-and-execution.md` | partial | `architecture/05-…`, `subagents/README.md`, `diagrams/delegation-flow.md` | Describes target systems; specialist personas documented under `subagents/`; no agent loop code here |
| MCP / tool boundaries | `architecture/06-mcp-and-tool-boundaries.md` | present | `architecture/06-…` | Separates UI, clients, managers, hooks, tool defs |
| Verification / reflection | `architecture/07-verification-and-reflection.md` | present | `architecture/07-…`, `commands/verify.md` | Multi-entry verification called out; no CI in package |
| Memory | `architecture/08-memory-pipelines.md` | present | `architecture/08-…`, `diagrams/memory-flow.md`, `commands/memory.md` | Pipeline split documented; no writers in package |
| Recovery | `architecture/09-recovery-and-resume.md` | present | `architecture/09-…`, `diagrams/resume-rewind-flow.md`, `commands/recovery.md` | Modes documented; no persistence code in package |
| Observability / human gates | `architecture/10-observability-and-human-gates.md` | present | `architecture/10-…`, `diagrams/permission-flow.md` | |
| Release / scope | `architecture/00-scope-and-rules.md` | present | `architecture/00-…`, `indexes/decisions-index.md` | Scope, publish boundary, governance hooks |

## When auditing another repository

Copy this table into your working notes and replace **Evidence paths** with paths from **that** codebase. Use `indexes/service-index.md` for service buckets.

## Reading order for audits

`00` → `01` → … → `10`, skipping layers marked **missing** until you confirm they are intentional.

## Related

- `commands/map.md` — refresh this table for a different workspace
- `indexes/glossary.md` — terms
