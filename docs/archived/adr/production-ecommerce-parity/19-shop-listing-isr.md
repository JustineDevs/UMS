# ADR Plan — Shop listing caching / ISR

| **Status** | Accepted |
| **Gap #** | 19 |

## Context

`shop/page.tsx` uses `force-dynamic`; PDP uses `revalidate = 120`.

## Decision

Introduce `revalidate` for default unfiltered listing; use `revalidateTag` on catalog mutations from admin (existing invalidation patterns if any).

## Concrete plan

1. Split static listing shell vs client facets if filters prevent full static.
2. Measure TTFB before and after.
3. Document stale time tradeoff for merchandising.

## Acceptance criteria

- Admin price change propagates within agreed SLA (tag revalidation or on-demand revalidate).
