# ADR Plan — JSON-LD product availability

| **Status** | Accepted |
| **Gap #** | 3 |

## Context

`buildJsonLdProduct` hardcodes `InStock` in `seo.ts`.

## Decision

Extend product type with inventory or `inStock` boolean; map to schema.org availability URLs.

## Concrete plan

1. Thread sellable flag from PDP loader (Medusa inventory or variant purchasable).
2. Unit tests: in stock, out of stock, zero variants.
3. Validate with Google Rich Results test.

## Acceptance criteria

- OOS products never emit `InStock` in JSON-LD.
