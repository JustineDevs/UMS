# 05 — Delegation and execution

## 1. Purpose

Define **delegation** (subagents, forked loops, background workers) and **execution** (core agent loop, tool runs) with correct isolation and shared contracts.

## 2. Scope

Delegated execution that **re-enters the same core query or agent loop** with isolated context, plus side-effect execution (tools, API calls).

## 3. Responsibilities

- Document shared parameters (for example cache keys) between parent and child runs.
- Clarify abort and telemetry propagation across delegation boundaries.

## 4. Non-responsibilities

- Transport wire format (see `06-mcp-and-tool-boundaries.md`).

## 5. Key concepts

- **Delegation is not a separate runtime** unless explicitly a different process; usually same engine, different context.
- **Forked agents** must not corrupt parent mutable state; use clones or scoped stores.

## 6. File and module touchpoints

Typical: fork helper, subagent runner, main loop module, task kill or cleanup utilities.

## 7. Common failure modes

- Cache key mismatch between parent and fork.
- Orphan tasks after parent abort.

## 8. Anti-patterns

- Copy-pasting loop logic instead of shared phase functions.

## 9. Editing guidance

Extract shared loop phases behind stable APIs; add integration test for parent-child handoff when possible.

## 10. Verification status

Stress tests for concurrent subagents; verify cleanup on interrupt.

## 11. Related docs

- `03-context-and-state.md`
- `06-mcp-and-tool-boundaries.md`
- `../subagents/README.md`
- `../diagrams/delegation-flow.md`

## What agents must do before editing

Read parent and child context construction; verify abort signal wiring and shared-state cloning.
