# 04 — Planning and routing

## 1. Purpose

Cover **task decomposition**, **plan storage**, and **routing** (model selection, tool subsets, feature gates, skill or MCP routing).

## 2. Scope

Plan mode, todo tools, routers, flags, and model configuration.

## 3. Responsibilities

- Keep routing decisions explicit and testable where possible.
- Document build-time vs runtime routing if both exist.

## 4. Non-responsibilities

- Executing tools (see `05-delegation-and-execution.md`).

## 5. Key concepts

- **Routing** chooses *who* or *what* runs next; **planning** chooses *steps*.
- Feature flags may freeze routing at build time; document impact.

## 6. File and module touchpoints

Typical: model config, router tables, plan commands, agent definition loaders, growth or experiment toggles.

## 7. Common failure modes

- Routing logic duplicated between main and delegated paths.
- Plan state not restored on resume.

## 8. Anti-patterns

- Hard-coded model strings scattered across modules.

## 9. Editing guidance

Centralize routing policy; add escape hatches for tests; update orchestration map when adding a new routed surface.

## 10. Verification status

Golden-path tests for routing matrix slices; logging of routed choice in debug builds.

## 11. Related docs

- `01-intent-and-commands.md`
- `05-delegation-and-execution.md`
- `../commands/agent-hub.md`
- `../subagents/command-router.md`
- `../subagents/README.md`

## What agents must do before editing

Map all call sites that set model or tool list; ensure delegated flows inherit or intentionally diverge with comments.
