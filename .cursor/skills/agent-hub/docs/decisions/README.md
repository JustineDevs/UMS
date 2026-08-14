# Architecture decisions (agent-hub)

Use this folder for **accepted or in-review** decision notes that affect orchestration boundaries, command sets, or hub scope.

## How to add a decision

1. Copy `templates/architecture-note-template.md` into this folder as `YYYY-MM-DD-short-title.md`.
2. Fill **Context**, **Decision**, **Consequences**, **Affected areas**, **Links**.
3. Add a row to `indexes/decisions-index.md` pointing to the file.

## Scope

- In scope: agent-hub docs, indexes, command specs, plugin metadata under `.claude-plugin/`.
- Out of scope: unrelated application repositories unless the decision explicitly ties to how agent-hub describes them.

## Status values

Use **draft**, **review**, **accepted**, or **superseded** in the note header. When superseding, link the old note from the new one and update `decisions-index.md`.
