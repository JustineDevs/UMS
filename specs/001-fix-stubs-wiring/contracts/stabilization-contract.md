# Stabilization Contract

## Route Resolution Contract

- Every in-scope UI or API entry point must resolve to a concrete page, handler, or explicit error boundary.
- Navigation must not terminate in placeholder routes, dead links, or handlers that silently no-op.

## Validation Consistency Contract

- Equivalent business inputs must be accepted or rejected consistently across all repaired entry points.
- Validation failure messaging must be explicit enough for callers or users to recover.

## Workflow Transition Contract

- Invalid transitions must fail before state mutation.
- Valid transitions that span multiple layers must leave related state synchronized.

## Unsupported Path Contract

- Any in-scope path intentionally left unimplemented in this pass must fail explicitly.
- Unsupported outcomes must be unambiguous and traceable to a known deferred repair item.

## Regression Contract

- Each repaired flow or rule boundary must have targeted automated or scriptable verification coverage.
- Verification must include at least one failure-path assertion for repaired validation or routing behavior.
