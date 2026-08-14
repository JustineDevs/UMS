# 07 — Verification and reflection

## 1. Purpose

Define **verification** (multi-entry: tests, lint, typecheck, review commands, schemas) and **reflection** (summaries, lessons, retry strategy).

## 2. Scope

Quality gates, post-mortem flows, user-visible review surfaces, internal analytics for decisions.

## 3. Responsibilities

- Inventory every verification **entry**; avoid claiming one command covers everything.
- Tie reflection outputs to durable memory only when policy allows (`08-memory-pipelines.md`).

## 4. Non-responsibilities

- Product marketing metrics unrelated to correctness.

## 5. Key concepts

- **Multi-entry verification** — CI, local scripts, and in-app review differ in coverage.
- **Reflection** informs next turn; it is not a substitute for automated tests.

## 6. File and module touchpoints

Typical: test configs, doctor or review commands, summary generators, analytics events (non-PII).

## 7. Common failure modes

- Late verification only at deploy time.
- Reflection writing sensitive content without redaction.

## 8. Anti-patterns

- “Run tests” as the only gate when type safety or contract tests are missing.

## 9. Editing guidance

Add gates closest to the change; document new entry in `indexes/command-index.md` if user-facing.

## 10. Verification status

Self-host: run applicable repo scripts when they exist after doc changes to commands.

## 11. Related docs

- `08-memory-pipelines.md`
- `10-observability-and-human-gates.md`

## What agents must do before editing

List existing gates; propose minimal additional gate for the change; avoid removing a gate without replacement.
