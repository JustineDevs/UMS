# 10 — Observability and human gates

## 1. Purpose

Cover **observability** (logs, metrics, traces, cost) and **human gates** (approvals, overrides, elicitation, escalation).

## 2. Scope

Telemetry initialization, PII-safe logging, permission UI, MCP elicitation, bridge or channel permission relays.

## 3. Responsibilities

- Ensure observability hooks do not log secrets or raw prompts when policy forbids.
- Align human gates with `02-policy-and-permissions.md` outcomes.

## 4. Non-responsibilities

- Vendor dashboard configuration.

## 5. Key concepts

- **Human gate** — explicit decision point; must be skippable only where policy allows.
- **Elicitation** — structured user input for tool errors; different code path from generic permission ask.

## 6. File and module touchpoints

Typical: telemetry bootstrap, event loggers, permission dialog components, elicitation handlers, bridge callbacks on app state.

## 7. Common failure modes

- Logging tool arguments containing secrets.
- Gate bypass in automated workers without coordinator path.

## 8. Anti-patterns

- Swallowing errors without observability or user feedback.

## 9. Editing guidance

Use structured events with allowlisted fields; add redaction helpers; test headless vs interactive divergence.

## 10. Verification status

Privacy review checklist; sampling of emitted events in staging.

## 11. Related docs

- `02-policy-and-permissions.md`
- `diagrams/permission-flow.md`

## What agents must do before editing

Trace full path from tool error to user prompt; confirm no duplicate resolution and no secret leakage in logs.
