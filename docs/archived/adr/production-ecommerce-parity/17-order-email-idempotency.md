# ADR Plan — Order email idempotency key

| **Status** | Accepted |
| **Gap #** | 17 |

## Context

`sendResendTransactionalEmail` in `order-placed-resend-email.ts` has no idempotency key.

## Decision

Pass `idempotencyKey: order-confirmation/${orderId}` (or Resend-supported format) through `@universal-music-store/resend-mail`.

## Concrete plan

1. Extend mail helper to forward Resend idempotency header if not already.
2. Unit test double subscriber invocation.
3. Monitor Resend dashboard for duplicate suppression.

## Acceptance criteria

- Duplicate `order.placed` delivery does not send two customer emails for same order id.
