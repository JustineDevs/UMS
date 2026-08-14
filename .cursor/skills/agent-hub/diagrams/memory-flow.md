# Diagram: memory pipelines

Three conceptual pipelines; your codebase may implement subsets.

```mermaid
flowchart LR
  subgraph rolling [Rolling session memory]
    A[Turn events] --> B[Writer A]
    B --> C[(Session artifact)]
  end
  subgraph extract [Durable extraction]
    D[Batch or fork] --> E[Writer B]
    E --> F[(Structured store)]
  end
  subgraph shared [Shared or team]
    G[Sync job] --> H[Scanner]
    H --> I[(Team store)]
  end
```

## Notes

- Writers must not fight over the same file without coordination; see `architecture/08-memory-pipelines.md`.
