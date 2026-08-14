# Command: map

## 1. Purpose

Produce or refresh the **orchestration layer table** (present / partial / missing) for the current workspace.

## 2. When to use

Onboarding, audits, or before large refactors when you need a snapshot of layer coverage.

## 3. Read first

- `indexes/orchestration-map.md`
- `architecture/00-scope-and-rules.md`

## 4. Expected output

Markdown table: Layer, Status, Evidence paths (from repo), Gap, Suggested owner module (conceptual).

## 5. Guardrails

Evidence paths must come from **actual** tree inspection. Mark “unknown” when not found.

## 6. Stop conditions

Stop if the workspace has no application source; produce a doc-only map and list assumptions.
