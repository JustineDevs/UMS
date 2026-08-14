# Command: recovery

## 1. Purpose

Clarify **resume**, **rewind**, **reconnect**, and **selector-driven** recovery patterns.

## 2. When to use

Session continuity bugs, checkpoint UX, or remote reconnect behavior.

## 3. Read first

- `architecture/09-recovery-and-resume.md`
- `diagrams/resume-rewind-flow.md`

## 4. Expected output

For each recovery mode: user trigger, persisted artifact, restore scope (messages vs files vs both), and failure modes.

## 5. Guardrails

Do not equate “open picker UI” with full state restore unless code confirms it.

## 6. Stop conditions

Stop if persistence layer for transcripts is unidentified; list required inspection targets only.
