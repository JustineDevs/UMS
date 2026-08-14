# Diagram: permission flow (simplified)

```mermaid
flowchart TD
  T[Tool call proposed] --> E{Evaluate rules}
  E -->|allow| A[Execute tool]
  E -->|deny| D[Return denial to model]
  E -->|ask| C{Automated checks?}
  C -->|coordinator path| P[Wait for classifiers or hooks]
  P -->|resolved| A
  P -->|unresolved| H[Human dialog or relay]
  C -->|interactive path| H
  H -->|allow| A
  H -->|deny| D
```

## Notes

- Remote or channel relays may substitute for local dialog; see `architecture/02-policy-and-permissions.md` and `10-observability-and-human-gates.md`.
