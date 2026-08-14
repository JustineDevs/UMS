# 03 — Context and state

## 1. Purpose

Explain **context assembly** (prompts, attachments, repo state) and **mutable state** ownership, with emphasis on high-risk central state.

## 2. Scope

Session identity, working directories, caches, telemetry handles, and prompt assembly boundaries.

## 3. Responsibilities

- Identify the **state hub** (often bootstrap or session module): treat as guarded.
- Separate ephemeral UI state from session-critical state.

## 4. Non-responsibilities

- Storage format of transcripts (see `08-memory-pipelines.md` and `09-recovery-and-resume.md`).

## 5. Key concepts

- **Central mutable state is dangerous** — new fields can affect subagents, compaction, and telemetry.
- **Context vs messages** — some UI messages must never reach model APIs.

## 6. File and module touchpoints

Typical: bootstrap state module, app store, context builders, attachment utilities, compaction services.

## 7. Common failure modes

- Split-brain paths (different cwd roots at import vs runtime).
- Leaking UI-only messages into API payloads.

## 8. Anti-patterns

- “Just add a global” without lifecycle and cleanup story.

## 9. Editing guidance

Prefer dependency injection or narrow facades; document every new state field with writer list and lifecycle.

## 10. Verification status

Type tests or state snapshot tests where feasible; otherwise mandatory code review for state hub edits.

## 11. Related docs

- `04-planning-and-routing.md`
- `08-memory-pipelines.md`

## What agents must do before editing

Locate the state hub; list readers and writers; refuse casual field additions without maintainer agreement.
