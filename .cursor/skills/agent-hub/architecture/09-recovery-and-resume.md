# 09 — Recovery and resume

## 1. Purpose

Distinguish **resume**, **rewind**, **reconnect**, **selector-driven recovery**, and **log-driven recovery**.

## 2. Scope

User flows and persistence artifacts that restore conversation or workspace state.

## 3. Responsibilities

- Name the mode explicitly in UX and code comments.
- Document what is restored (messages only, files, both, partial).

## 4. Non-responsibilities

- Network transport reconnection policy for unrelated services.

## 5. Key concepts

- **Resume** — continue prior session from stored logs or ids.
- **Rewind** — may be UI selector only; confirm actual revert scope in code.
- **Reconnect** — wire alive again; may not replay full state without extra sync.
- **Selector-driven** — user picks checkpoint from UI.
- **Log-driven** — automatic restore from serialized transcripts.

## 6. File and module touchpoints

Typical: resume command module, message selector hooks, session storage utilities, remote session manager.

## 7. Common failure modes

- Assuming picker UI implies filesystem rollback.
- Cross-project resume without path validation.

## 8. Anti-patterns

- Silent partial restore without user-visible indication.

## 9. Editing guidance

Add integration test or manual script for each new recovery mode; update `diagrams/resume-rewind-flow.md`.

## 10. Verification status

Manual QA matrix per mode; automated tests when storage layer is injectable.

## 11. Related docs

- `03-context-and-state.md`
- `diagrams/resume-rewind-flow.md`

## What agents must do before editing

Read persistence write and read paths for the mode; verify idempotency and security of cross-project resume.
