# Command: memory

## 1. Purpose

Analyze or design **memory pipelines** (session, extraction, shared) without collapsing them into one concept.

## 2. When to use

Session notes, background summarization, team memory, extracted facts, or confusion between memory types.

## 3. Read first

- `architecture/08-memory-pipelines.md`
- `diagrams/memory-flow.md`

## 4. Expected output

Per-pipeline: trigger, writer, reader, storage shape, retention, and anti-confusion rules.

## 5. Guardrails

Separate rolling session memory from durable extraction from shared or team channels unless a single facade is proven.

## 6. Stop conditions

Stop if secret or PII scanning policy is unknown; do not design writers without policy alignment.
