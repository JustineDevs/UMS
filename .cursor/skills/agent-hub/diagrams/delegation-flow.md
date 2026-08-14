# Diagram: delegation flow

Delegated work re-enters the **same core loop** with **isolated context** unless a separate process is explicitly documented.

```mermaid
sequenceDiagram
  participant Parent
  participant Router
  participant ChildLoop
  participant Tools
  Parent->>Router: choose subagent or fork
  Router->>ChildLoop: spawn with cloned context and abort child
  ChildLoop->>Tools: tool calls under child permissions
  Tools-->>ChildLoop: results
  ChildLoop-->>Parent: aggregate result or transcript handoff
  Parent->>Parent: merge or display per UX rules
```

## Notes

- Cache or prompt parameters may need alignment between parent and child; see `architecture/05-delegation-and-execution.md`.
- Specialist **documentation personas** for delegated slices live under `subagents/`; the universal dispatcher is `commands/agent-hub.md`.
