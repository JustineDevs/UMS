# 02 — Policy and permissions

## 1. Purpose

Define **policy** (org limits, budgets, path rules) and **permission** resolution for tool and action execution.

## 2. Scope

Rule sources, evaluation order, human-in-the-loop gates, remote or relayed permission bridges.

## 3. Responsibilities

- Separate config-based allow/deny from interactive prompts.
- Document classifier or automated pre-checks before dialogs when present.

## 4. Non-responsibilities

- Individual tool business logic (see `06-mcp-and-tool-boundaries.md`).

## 5. Key concepts

- **Behavior outcomes:** allow, deny, ask.
- **Coordinator and worker paths:** different agents may need automated checks before UI.

## 6. File and module touchpoints

Typical: centralized permission engine module, hook or React integration for prompts, policy fetch services, channel or bridge callbacks on app state.

## 7. Common failure modes

- Double resolution of the same permission promise.
- Stale dialogs after abort or reconnect.

## 8. Anti-patterns

- Skipping `ask` path in headless modes without explicit safe default.

## 9. Editing guidance

Add rules in one parser; add tests for rule precedence; update human-gate doc if UX changes.

## 10. Verification status

Requires behavioral tests or manual matrix for allow/deny/ask combinations for high-risk tools.

## 11. Related docs

- `10-observability-and-human-gates.md`
- `06-mcp-and-tool-boundaries.md`

## What agents must do before editing

Read existing rule sources and permission hook chain; never add a new gate without defining resolution order.
