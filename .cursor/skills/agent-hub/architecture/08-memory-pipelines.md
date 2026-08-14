# 08 — Memory pipelines

## 1. Purpose

Treat **memory as multiple pipelines**, not one subsystem: rolling session, durable extraction, shared or team channels, each with distinct triggers and writers.

## 2. Scope

What gets written, when, by which component, and who reads it.

## 3. Responsibilities

- Name each pipeline separately in design discussions.
- Define writer boundaries to avoid conflicting updates.

## 4. Non-responsibilities

- Raw transcript file format details (cross-link to persistence doc in application docs when present).

## 5. Key concepts

- **Rolling session memory** — frequent, lightweight updates.
- **Durable extraction** — async or batched, higher latency, structured output.
- **Shared or team memory** — policy, scanning, and sync rules required.

## 6. File and module touchpoints

Typical: session memory service, extractors, sync jobs, filesystem path helpers, secret scanners for team sync.

## 7. Common failure modes

- Two writers overwriting the same artifact without coordination.
- Confusing session scratchpad with durable user profile.

## 8. Anti-patterns

- Single `memory.ts` that does everything.

## 9. Editing guidance

Introduce facades per pipeline; document triggers in this file when behavior changes.

## 10. Verification status

Content safety review for extraction prompts; redaction tests for shared sync.

## 11. Related docs

- `03-context-and-state.md`
- `07-verification-and-reflection.md`

## What agents must do before editing

Draw a small diagram of writers and readers; confirm PII and secret policies before adding extractors.
