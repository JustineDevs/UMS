# ADR Plan — Reviews distribution and controls

| **Status** | Accepted |
| **Gap #** | 12 |

## Context

`ProductReviewsSection` shows average and list only.

## Decision

Add histogram (5–1 stars), sort (helpful, high, low), star filter, helpful votes, optional review images.

## Concrete plan

1. Extend `product-reviews` API and table if needed for votes and image URLs.
2. Client state for filters; server query params or POST for persistence.
3. Accessibility for chart and filters.

## Acceptance criteria

- Large review sets remain usable; no N+1 unbounded fetch without pagination.
