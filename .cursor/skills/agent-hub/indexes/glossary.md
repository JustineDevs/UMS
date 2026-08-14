# Glossary

| Term | Meaning |
|------|---------|
| **Intent** | User goal as it first enters the system (command, click, API). |
| **Policy** | Org or product rules: limits, allowlists, managed settings. |
| **Permission** | Per-action allow / deny / ask, possibly with human dialog. |
| **Context** | Assembled prompt state: files, rules, attachments, compaction output. |
| **State hub** | Central mutable session or bootstrap module; high-risk edit surface. |
| **Routing** | Choosing model, tools, skills, or MCP surfaces for the next step. |
| **Planning** | Decomposing work into steps or todos (may be model- or tool-driven). |
| **Delegation** | Handing work to a child agent or forked loop with isolated context. |
| **Subagent (agent-hub)** | Specialist worker profile in `subagents/*.md`: narrow responsibility, read-first list, outputs, guardrails, handoffs; not a duplicate of full architecture text. |
| **Dispatcher** | `commands/agent-hub.md`: classifies work and picks command, skill, subagent, or combined routing modes. |
| **Execution** | Running tools, shell, edits, or API calls after permission. |
| **Transport** | Wire protocol clients (HTTP, WebSocket, MCP framing), not UI widgets. |
| **MCP / tool boundary** | Layer that separates tool definitions, UI surfaces, protocol clients, connection managers, and hooks; see `architecture/06-mcp-and-tool-boundaries.md`. |
| **Verification** | Any gate: unit test, lint, typecheck, schema, review command. |
| **Reflection** | Summaries, retry reasoning, lesson extraction (not a substitute for tests). |
| **Memory pipeline** | Distinct path for rolling notes vs extraction vs shared memory. |
| **Resume** | Continue prior session from stored identity and logs. |
| **Rewind** | User-directed rollback in time; may be conversation-only or include files (confirm in code). |
| **Reconnect** | Restore live channel after drop; may not imply full state replay. |
| **Human gate** | Explicit approval, elicitation, or override step. |
| **Observability** | Logs, metrics, traces, cost accounting with policy constraints. |
| **agent-hub** | This documentation and skill package; orchestration canon for work guided by these docs. |
| **Canonical command spec** | Normative workflow in `commands/*.md`; optional editor files must not contradict it long-term. |
| **Published skill unit** | This directory tree as installed by the publisher; excludes optional host-only config unless bundled. |
| **Decision note** | Architecture note using `templates/architecture-note-template.md`, indexed in `indexes/decisions-index.md`. |
