# 01 — Intent and commands

## 1. Purpose

Describe where **user intent** enters the system (CLI, slash commands, API handlers, UI actions) and how command registries relate to the agent loop.

## 2. Scope

Intent capture, command registration, scheduling into work queues, and user-visible command surfaces.

## 3. Responsibilities

- Map entrypoints to owners (registry module, handler, transport).
- Clarify priority between competing inputs (for example user vs system notifications).

## 4. Non-responsibilities

- Permission decisions (see `02-policy-and-permissions.md`).
- Tool implementation (see `05-` and `06-`).

## 5. Key concepts

- **Command registry** — central list vs distributed command modules.
- **Intent queue** — unified queue with priorities for fair draining between user and system sources.

**Doc-native commands (this package):** agent-hub ships **markdown command specs** under `commands/`, not an executable registry. **`commands/agent-hub.md`** is the universal dispatcher (command, skill, subagent, or combined modes). **`subagents/*.md`** holds specialist worker profiles that link into canon rather than replacing it. **`SKILL.md`** is the machine-readable entry for skill hosts. Optional **editor launchers** outside `agent-hub/` may duplicate routing; they are **non-normative** if they conflict with `commands/*.md`. See `indexes/command-index.md` for the canonical source ladder.

## 6. File and module touchpoints

Typical patterns (names vary by codebase): root command registry, `commands/` or `cli/` subtrees, message queue utilities, REPL input handlers.

**In agent-hub only:** `commands/*.md` (normative), `subagents/*.md` (specialist profiles), `SKILL.md` (discovery), `indexes/command-index.md` (registry of specs, subagents roster, optional launchers).

## 7. Common failure modes

- Duplicate command definitions.
- Starvation of user input behind system notifications.

## 8. Anti-patterns

- Embedding business orchestration inside a single command handler with no shared planning path.

## 9. Editing guidance

Add commands in one registry pattern; document new entries in `indexes/command-index.md`.

## 10. Verification status

Confirm with integration or e2e tests for critical commands when they exist.

## 11. Related docs

- `04-planning-and-routing.md`
- `05-delegation-and-execution.md`
- `../indexes/command-index.md`

## What agents must do before editing

Trace full path from user input to queue drain; identify duplicate registries; read permission flow if commands invoke tools.
