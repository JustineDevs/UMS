---
name: agent-hub
description: Plug-and-play orchestration skill. User states a goal in natural language; the model runs commands/agent-hub.md (dispatcher), classifies work via agent/operating-model.md, then opens only the matching command or architecture doc (map, architect, memory, recovery, verify, next-pass, or one NN-layer). Layered docs for intent, policy, context, planning, routing, delegation, execution, MCP/tool boundaries, verification, memory, recovery, observability, human gates, release. Use for repo orchestration reviews, boundary work, memory/recovery design, permission-sensitive refactors.
license: See repository LICENSE
---

# agent-hub (machine-readable entrypoint)

## What this is

**agent-hub** is a documentation-driven **control plane for agents**: layered architecture, indexes, diagrams, templates, command specs, and explicit editing rules. Application code under review may live **outside this folder**; this package defines **how to navigate and change it safely**.

**Plug-and-play:** Start from **`commands/agent-hub.md`** when the user’s goal is broad or ambiguous. Infer intent, then route to the smallest command or single **`architecture/NN-*.md`**.

**Canonical path:** `SKILL.md` at the root of this package (this file).

## Read first (minimum)

1. `agent/README.md` — operating scope for agents using this package.
2. `agent/operating-model.md` — classify tasks and pick a route.
3. `architecture/00-scope-and-rules.md` — global rules and doc authority.

Then branch by task using `indexes/orchestration-map.md` and the matching `architecture/NN-*.md` file. For delegated specialist work, see `subagents/README.md` and run routing via `commands/agent-hub.md`.

## What not to assume

- Do not assume a particular framework, vendor SDK, or single entry file name in application code.
- Do not assume one universal verification command covers all quality gates; verification is multi-entry (skill, command, workflow). See `architecture/07-verification-and-reflection.md`.
- Do not assume memory is one subsystem; session, durable extraction, and shared team memory differ in triggers and writers. See `architecture/08-memory-pipelines.md`.
- Do not assume UI control flow equals MCP transport, client logic, or tool execution. See `architecture/06-mcp-and-tool-boundaries.md`.

## Where to look

| Concern | Primary doc |
|---------|-------------|
| Orchestration overview | `indexes/orchestration-map.md` |
| Intent and commands | `architecture/01-intent-and-commands.md` |
| Policy and permissions | `architecture/02-policy-and-permissions.md` |
| Context and state | `architecture/03-context-and-state.md` |
| Planning and routing | `architecture/04-planning-and-routing.md` |
| Delegation and execution | `architecture/05-delegation-and-execution.md` |
| MCP and tool boundaries | `architecture/06-mcp-and-tool-boundaries.md` |
| Verification and reflection | `architecture/07-verification-and-reflection.md` |
| Memory pipelines | `architecture/08-memory-pipelines.md` |
| Recovery and resume | `architecture/09-recovery-and-resume.md` |
| Observability and human gates | `architecture/10-observability-and-human-gates.md` |
| Release and scope | `architecture/00-scope-and-rules.md` |
| Specialist subagents | `subagents/README.md` |
| Cursor launcher setup (paste into chat) | `COMMANDS.md` |

## High-risk areas (typical patterns)

- **Central mutable session or bootstrap state**: guarded boundary; do not add fields casually. See `architecture/03-context-and-state.md`.
- **Main query or agent loop modules**: high blast radius; prefer phased extraction. See `architecture/05-delegation-and-execution.md`.
- **Permission and human-gate hooks**: easy to double-resolve or bypass; coordinate with `architecture/02-policy-and-permissions.md` and `10-observability-and-human-gates.md`.
- **MCP clients and connection managers**: easy to conflate with UI; see `06-mcp-and-tool-boundaries.md`.

## Choosing commands vs docs vs agent guidance vs subagents

- **Universal dispatcher**: `commands/agent-hub.md` (routing modes, when to assign a specialist first).
- **Quick launcher**: other `commands/*.md`, or optional workspace `.cursor/commands/agent-hub-*.md` / `agent-hub.md` when present (see `indexes/command-index.md`). To create those files automatically, the user can attach `COMMANDS.md` and follow its paste prompt.
- **Specialist persona**: `subagents/*.md` for scoped analysis or planning; they link into canon instead of replacing it.
- **Deep boundary rules**: `architecture/*.md`.
- **Behavioral contract** (stop conditions, escalation): `agent/*.md`.
- **Full audit**: `commands/architect.md` workflow, then `templates/inspection-pass-template.md`.

## Commands index

See `indexes/command-index.md` for canonical `commands/*.md` versus optional editor launchers.

## Decisions

- `indexes/decisions-index.md` — architecture decision log pointers.
- `docs/decisions/README.md` — how to record decisions.
