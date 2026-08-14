# 06 — MCP and tool boundaries

## 1. Purpose

Separate **tool definitions**, **UI control surfaces**, **transport and execution logic**, **connection managers**, **hooks**, and **protocol clients** (including MCP) so changes stay localized and responsibilities stay testable.

## 2. Scope

Tool schema and model-facing contracts, in-process or remote execution bodies, progress or control UI, MCP and similar protocol clients, connection managers, pre/post hooks, LSP or other auxiliary transports.

## 3. Responsibilities

- Keep one mental model per concern: **tool definition** vs **UI** vs **client** vs **manager** vs **hook**.
- Document which layer validates paths, arguments, or commands before execution.
- State explicitly that **UI control surfaces are not the same** as tool transport or execution implementation.

## 4. Non-responsibilities

- Permission outcomes and human-gate decisions (see `02-policy-and-permissions.md`).
- High-level delegation policy (see `05-delegation-and-execution.md`).

## 5. Key concepts

- **UI control surfaces** (panels, prompts, Ink/React views) must not own wire protocol or retry policy; they reflect state and collect input.
- **Connection managers** coordinate lifecycle: connect, reconnect, backoff, cleanup; they are not tool business logic.
- **Clients** speak a protocol (HTTP, WebSocket, MCP framing); they map errors and timeouts; they do not replace permission layers.
- **Hooks** observe or wrap phases; they must not silently bypass validation or policy.
- **Tool definitions** expose the model-facing contract (name, schema, description); execution bodies live behind that boundary.

## 6. File and module touchpoints

Typical patterns (names vary by codebase): `*Tool.ts`, `*.tsx` for UI, `client.ts`, `*Manager.ts`, `*Transport.ts`, hook registries, normalization utilities.

## 7. Common failure modes

- Validation only in UI so headless or SDK paths skip checks.
- Leaking transport errors as raw model text without classification.
- Treating MCP UI affordances as if they were the same module as MCP client execution.

## 8. Anti-patterns

- God file mixing prompt text, execution, validation, analytics, and transport.
- Using connection manager callbacks to implement business rules that belong in services.

## 9. Editing guidance

Split shared validation out of UI; reuse it for interactive and non-interactive entrypoints. When adding MCP or another transport, add a row to `indexes/service-index.md` and link from this doc if behavior is non-obvious.

## 10. Verification status

Prefer unit tests for validation and mapping; contract or integration tests for client error paths when a harness exists. Docs-only workspaces: trace the path manually and record gaps in `indexes/orchestration-map.md`.

## 11. Related docs

- `02-policy-and-permissions.md`
- `05-delegation-and-execution.md`
- `10-observability-and-human-gates.md`

## What agents must do before editing

Trace the full path from model tool call through validation, permission, execution, and result serialization. Confirm whether the change touches UI only, client only, or both, and update the right layer.
