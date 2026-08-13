# ADR Plan — JSON-LD sku, brand, priceValidUntil, aggregateRating

| **Status** | Accepted |
| **Gap #** | 4 |

## Context

Product schema lacks fields expected for Shopping and rich results.

## Decision

Add `sku` (primary variant), `brand` (product brand string), `offers.priceValidUntil` (policy: now + 30 days), `aggregateRating` from existing review summary.

## Concrete plan

1. Extend `buildJsonLdProduct` signature; update PDP call site.
2. If no reviews, omit `aggregateRating` rather than fabricate.
3. Unit test full JSON-LD object shape.

## Acceptance criteria

- Rich Results test shows no critical missing fields for your merchant program.
