# Routing rules — agent-hub plugin

## Goal

Pick the **smallest** correct path: skill entry, single architecture doc, command launcher, or specialist subagent. Avoid loading the entire doc tree by default.

## Decision tree

1. **User asks “where do I start?”**  
   Route → `README.md` then `architecture/00-scope-and-rules.md`.

2. **User asks “how should the agent behave?”**  
   Route → `agent/operating-model.md` + `agent/editing-rules.md`.

3. **User names a layer** (e.g. “memory”, “permissions”, “recovery”)  
   Route → matching `architecture/NN-*.md` (see `indexes/orchestration-map.md`).

4. **User wants a repeatable workflow**  
   Route → matching file under `commands/` for that topic.

5. **User wants full architecture audit**  
   Route → `commands/architect.md` → fill `templates/inspection-pass-template.md`.

6. **User works in Cursor**  
   Route → optional workspace `.cursor/commands/` dispatcher when present; normative specs remain `commands/*.md` (see `indexes/command-index.md`).

7. **Routing is ambiguous or the task is architecture-sensitive, multi-step, or domain-specific**  
   Route → `commands/agent-hub.md`; consider a specialist from `subagents/*.md` before a single generic path (see `subagents/README.md`).

## Precedence

1. Explicit user path (“open memory doc”) overrides heuristics.  
2. `SKILL.md` at the agent-hub package root defines reading order when the host loads this skill.  
3. Plugin metadata in `marketplace.json` is descriptive; routing logic in this file is normative for plugin-assisted sessions.

## Anti-patterns

- Dumping all `architecture/*.md` into context for a single-file fix.  
- Skipping `agent/editing-rules.md` before cross-cutting refactors.  
- Conflating UI event paths with execution, MCP, or transport boundaries (see `architecture/06-mcp-and-tool-boundaries.md`).  
- Skipping specialist consideration for architecture-sensitive or multi-step work when `commands/agent-hub.md` applies.
