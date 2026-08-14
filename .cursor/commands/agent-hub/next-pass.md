# Command: next-pass

## 1. Purpose

After a partial review, list **concrete next files or modules** to open, prioritized.

## 2. When to use

Large codebases, time-boxed reviews, or kernel modules too big to read whole.

## 3. Read first

- `templates/inspection-pass-template.md`
- `indexes/service-index.md` (for category hints)

## 4. Expected output

Ordered list: path, why it matters, what question it answers, estimated risk if skipped.

## 5. Guardrails

Cap default list at **seven** items unless user asks for exhaustive.

## 6. Stop conditions

If repo root is empty of source, output doc and index review steps only.
