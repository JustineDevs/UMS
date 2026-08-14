# Editing rules

## Preconditions (before non-doc code edits)

1. Identify **which orchestration layer** is affected (`operating-model.md`).
2. Read the matching **`architecture/NN-*.md`** section “What agents must do before editing”.
3. Confirm **tests or typecheck** path for the target package (if any); if unknown, document gap in the inspection template.
4. For **permission or human-gate** changes, read `architecture/02-policy-and-permissions.md` and `10-observability-and-human-gates.md`.

## High-risk zones (generic patterns)

- **Central session or bootstrap state** — Adding fields or side effects can break subagents, telemetry, and recovery. Prefer facades and narrow APIs.
- **Main agent loop** — Mixing unrelated phases increases regression risk; extract behind stable function signatures.
- **Permission resolution** — Multiple handlers (interactive, coordinator, relay) must not double-resolve promises.

## Stop conditions

Stop and ask the user when:

- Requirements conflict across two architecture layers.
- Change requires new global mutable state without an agreed home.
- Verification path is missing and change is security- or data-sensitive.

## Documentation obligation

After substantive behavior change:

- Update the relevant **`architecture/NN-*.md`** “Verification status” and touchpoints.
- If new commands or workflows appear, add **`commands/*.md`** and **`indexes/command-index.md`**.
- If new delegated specialist profiles appear, add **`subagents/<name>.md`**, update **`subagents/README.md`**, and register the file in **`indexes/command-index.md`**.
- For hub scope or boundary decisions, add a **`indexes/decisions-index.md`** row and a note under **`docs/decisions/`** using **`templates/architecture-note-template.md`**.

## Doc-only edits

Edits under `agent-hub/` (docs, indexes, templates) do not require application tests but should keep **cross-links** and **indexes** consistent.
