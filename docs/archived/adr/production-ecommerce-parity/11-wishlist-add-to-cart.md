# ADR Plan — Wishlist add to cart

| **Status** | Accepted |
| **Gap #** | 11 |

## Context

`WishlistPageClient` only View and Remove.

## Decision

Add **Add to bag** using default variant or open variant modal if matrix product.

## Concrete plan

1. Resolve `medusaProductId` or slug to default variant via existing catalog fetch.
2. Call `writeCart` / same path as PDP add-to-cart.
3. Toast on success and optional remove from wishlist toggle.

## Acceptance criteria

- One click adds correct variant and quantity 1 without PDP navigation.
