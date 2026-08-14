# Diagram: startup sequence

Textual sequence for a typical agent CLI or desktop bootstrap. Adjust labels to match your codebase.

```mermaid
sequenceDiagram
  participant Main
  participant Config
  participant Policy
  participant Telemetry
  participant Loop
  Main->>Config: load settings and env
  Config->>Policy: init remote policy or managed settings (if any)
  Policy-->>Main: restrictions or fail-open continue
  Main->>Telemetry: init meters or loggers (if enabled)
  Main->>Loop: start REPL or headless runner
  Note over Loop: Intent enters via commands or API
```

## Notes

- Order may interleave trust dialogs and safe env application before network calls.
- See `architecture/00-scope-and-rules.md` and `03-context-and-state.md`.
