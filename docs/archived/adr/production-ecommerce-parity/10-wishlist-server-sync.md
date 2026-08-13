# ADR Plan — Server-side wishlist

| **Status** | Accepted |
| **Gap #** | 10 |

## Context

`wishlist.ts` uses `localStorage` only.

## Decision

Supabase table keyed by `medusa_customer_id`; CRUD API routes; merge localStorage on login.

## Concrete plan

1. Migration in `packages/database` with RLS for customer scope.
2. API under `/api/wishlist` with NextAuth session to resolve Medusa customer id.
3. Migration script optional for one-time localStorage import prompt.

## Acceptance criteria

- Same wishlist on two browsers after login.
