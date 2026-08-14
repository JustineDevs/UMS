# Command: verify

## 1. Purpose

Align **verification** with real entry points (test, lint, typecheck, review commands, schema checks).

## 2. When to use

CI design, pre-merge gates, or “how do we know this is safe” questions.

## 3. Read first

- `architecture/07-verification-and-reflection.md`

## 4. Expected output

Inventory of verification **surfaces**, what each proves, gaps, and recommended minimal gate for the current change.

## 5. Guardrails

Do not assume one slash-command equals full verification unless documented.

## 6. Stop conditions

Stop if no test or typecheck config exists; propose doc-only checklist and tracking issue for CI.
