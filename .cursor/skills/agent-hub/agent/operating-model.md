# Operating model

## Principles

1. **Smallest context** — Load the minimum docs to decide safely.
2. **Layer-first** — Map work to one orchestration layer before touching code.
3. **Docs track truth** — After behavior changes, update the matching architecture doc.
4. **Human gates** — When policy or risk is unclear, stop and ask; do not infer approval.

## Task classes

| Class | Signals | Primary route |
|-------|---------|----------------|
| **A — Intent / UX** | New command, CLI flag, user entry | `architecture/01-intent-and-commands.md` |
| **B — Policy** | Permissions, allowlists, org limits | `architecture/02-policy-and-permissions.md` |
| **C — Context** | Prompt assembly, compaction, attachments | `architecture/03-context-and-state.md` |
| **D — Planning / routing** | Model choice, tool subsets, flags | `architecture/04-planning-and-routing.md` |
| **E — Delegation** | Subagents, forked loops, isolation | `architecture/05-delegation-and-execution.md` |
| **F — Execution** | Tool impl, API clients, workers | `architecture/05-` + `06-mcp-and-tool-boundaries.md` |
| **G — Verification** | Tests, lint, review flows | `architecture/07-verification-and-reflection.md` |
| **H — Memory** | Session notes, extraction, shared memory | `architecture/08-memory-pipelines.md` |
| **I — Recovery** | Resume, rewind, reconnect | `architecture/09-recovery-and-resume.md` |
| **J — Observability / gates** | Metrics, logs, approvals | `architecture/10-observability-and-human-gates.md` |

## Minimal context policy

- **Single-layer fix**: one `architecture/NN-*.md` + `indexes/glossary.md` if terms unclear.
- **Cross-layer change**: `architecture/00-scope-and-rules.md` + each touched layer doc + `diagrams/` if flows split.
- **Full audit**: `templates/inspection-pass-template.md` + all architecture files in phases, not all at once in one prompt.

## Escalation

Escalate to a human when: policy ambiguity, destructive automation, secret handling, or edits to central global state modules without maintainer sign-off (see `editing-rules.md`).
