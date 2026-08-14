# 00 — Scope and rules

## 1. Purpose

Define **authority**, **scope**, and **global rules** for the agent-hub documentation system and its relationship to **application code outside this package** when agents use these docs to work on a codebase.

## 2. Scope

**In scope:** `agent-hub/` tree (README, SKILL, architecture, indexes, diagrams, templates, commands, subagents, agent guidance, `docs/decisions/`, plugin metadata under `.claude-plugin/`).  
**Out of scope:** Defining vendor branding, third-party SLA, or undocumented runtime behavior. Optional subtrees such as `external/` are out of scope for canon unless explicitly bridged in a decision note.

**Published unit:** The packaged skill is this directory tree. Paths **outside** it (editor config, application source under review) are **context**; they are not required parts of the skill bundle unless your publisher says otherwise.

## 3. Responsibilities

- Single navigable canon for orchestration layers and editing guardrails.
- Release **awareness**: documentation should track versioning expectations (see below).
- Cross-links between indexes, architecture, and commands.

## 4. Non-responsibilities

- Owning CI configuration unless explicitly added under this tree.
- Replacing legal or security review processes.

## 5. Key concepts

- **Doc authority:** These docs define **how to work**; application code defines **what runs**. On conflict after verification, update docs.
- **Layered truth:** Each `NN-*.md` owns one layer; avoid duplicating full stack descriptions.
- **Release awareness:** Changelog discipline, semver (if applicable), and migration notes belong in your release process; link from `indexes/command-index.md` when release automation exists.
- **Canonical triad:** Normative workflows in `commands/*.md`; machine-readable summary in `SKILL.md`; optional editor launchers mirror `commands/` and must not diverge (see `indexes/command-index.md` and `01-intent-and-commands.md`).

## 6. File and module touchpoints

- `README.md`, `SKILL.md` — entrypoints within this package.
- `indexes/*`, `docs/decisions/` — navigation and decision history.
- `.claude-plugin/marketplace.json` — marketplace listing and plugin identity (same shape as other skills in this collection); `capabilities.md` and `routing-rules.md` — capability and routing notes for hosts that read them.

## 7. Common failure modes

- Stale indexes after new commands.
- Architecture docs drifting from code after refactors without updates.

## 8. Anti-patterns

- One mega-doc replacing the layered set.
- Teaching workflows that bypass permission and human-gate layers.

## 9. Editing guidance

When adding a new cross-cutting concern, either extend the closest layer doc or add an index row first, then deep-link.

## 10. Verification status

Docs-only: verify links manually or with a link checker in CI when available.

## 11. Related docs

- `01-intent-and-commands.md` through `10-observability-and-human-gates.md`
- `agent/editing-rules.md`
- `../indexes/command-index.md`, `../indexes/decisions-index.md`

## What agents must do before editing

Read this file once per session for global rules; read layer docs before code changes.
