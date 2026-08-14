# Command: agent-hub (dispatcher)

## 1. Purpose

**Plug-and-play entry:** classify what the user wants, then route to the **smallest** sufficient set of docs, another command spec, or a specialist subagent. The user does not need to name a layer or file; **you** infer intent and pick the route.

## 2. When to use

- Open-ended asks: “help with this repo”, “orchestration”, “agents”, “not sure what to run”.
- Ambiguous scope: permissions, memory, recovery, MCP, or “full review”.
- Any time the user’s **desire** is clear but the **workflow** is not.

## 3. Read first

In this workspace, paths are under **`.cursor/skills/agent-hub/`** (skill pinned in `skills-lock.json` as `agent-hub` from `justinedevs/collection`).

- `SKILL.md`
- `agent/operating-model.md` (task classes A–J)
- `indexes/orchestration-map.md`

Command specs for follow-on routes live beside this file under **`.cursor/commands/agent-hub/*.md`** (see `indexes/command-index.md` in the skill tree).

## 4. Expected output

1. One short **route statement**: inferred user goal, task class (A–J), chosen path.
2. **Then** open only the listed docs or run the listed command spec **in order** (do not preload the whole tree).

### Routing logic (pick one primary path)

| User signal | Route |
|-------------|--------|
| Wants a **layer table** for this workspace | `commands/map.md` |
| Wants a **full architecture pass** or phased plan | `commands/architect.md` |
| **Session notes vs extraction vs team memory** | `commands/memory.md` |
| **Resume / rewind / reconnect** | `commands/recovery.md` |
| **Tests, lint, CI, quality gates** | `commands/verify.md` |
| **What to open next** after a partial review | `commands/next-pass.md` |
| **Single-layer** question (named: permissions, context, MCP, …) | One matching `architecture/NN-*.md` only |
| **Architecture-sensitive, multi-step, domain-specific** | Consider `subagents/*.md` per `subagents/README.md` before defaulting to one generic path |
| **Only navigation / “what is agent-hub”** | `README.md` + `indexes/command-index.md` |

Optional: a repo-root **`.cursor/commands/agent-hub.md`** launcher can point here; this skill does not ship `.cursor/` (see `indexes/command-index.md`).

## 5. Guardrails

- Do not load every `architecture/*.md` for a narrow fix.
- Do not edit application code without `agent/editing-rules.md`.
- Do not claim layer status without citing paths you inspected.

## 6. Stop conditions

Stop if classification needs policy or security context you lack; ask the user.
