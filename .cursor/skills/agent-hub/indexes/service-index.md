# Service index (conceptual)

Use this index to classify **application services** typical of agent products. Names vary by codebase; map your tree into these buckets when auditing a **runtime** repository.

For the **agent-hub package itself**, the **Actual path (this package)** column records what exists here (often none: this is a doc skill).

| Category | Typical responsibilities | Architecture cross-links | Actual path (this package) |
|----------|---------------------------|---------------------------|----------------------------|
| **API client** | Model or backend HTTP, retries, usage logging | `05-delegation-and-execution.md`, `10-observability-and-human-gates.md` | — |
| **Policy remote** | Org limits, managed settings, fail-open fetch | `02-policy-and-permissions.md` | — |
| **MCP** | Server config, clients, elicitation, channel permissions | `06-mcp-and-tool-boundaries.md`, `10-observability-and-human-gates.md` | — |
| **Session memory** | Rolling notes, extraction triggers | `08-memory-pipelines.md` | — |
| **Team memory sync** | Shared memory with scanning and guardrails | `08-memory-pipelines.md`, `02-policy-and-permissions.md` | — |
| **Session persistence** | Transcripts, logs, queue operations, resume data | `09-recovery-and-resume.md`, `03-context-and-state.md` | — |
| **Compaction / context** | Token management, collapse, summaries | `03-context-and-state.md`, `07-verification-and-reflection.md` | — |
| **Analytics / telemetry** | Events, metrics, traces (PII-safe) | `10-observability-and-human-gates.md` | — |
| **LSP** | Diagnostics, language server lifecycle | `06-mcp-and-tool-boundaries.md` | — |
| **Plugins** | Extension load, hooks | `01-intent-and-commands.md`, `04-planning-and-routing.md` | `.claude-plugin/` (metadata only) |
| **Remote session** | Viewer or relay semantics, permission bridge | `09-recovery-and-resume.md`, `02-policy-and-permissions.md` | — |
| **Bridge / relay** | Long-lived session orchestration, auth refresh | `05-delegation-and-execution.md`, `10-observability-and-human-gates.md` | — |
| **Orchestration docs** | Layered canon, commands, indexes | `00-` through `10-`, `commands/` | `architecture/`, `commands/`, `indexes/`, `agent/` |

## How to use

When inspecting an **application** codebase, add or fill an **Actual path** column for **that** repo’s modules. For work limited to this package’s docs, use the rightmost column above.

## Related

- `commands/map.md`, `commands/architect.md`
- `indexes/orchestration-map.md`
