# ADR Plan PH-08 — Storefront home CMS editor

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 8 |
| **Tier** | T2 High |

## Context

`StorefrontHomeEditor.tsx` and `packages/platform-data/src/storefront-home-cms.ts` manage `storefront_home_content`. Storefront must read published content deterministically.

## Decision (target state)

Draft and publish states are explicit; public site reads only published revision; cache tags or revalidation wired if Next.js caches home.

## Concrete plan

1. Trace admin save API to Supabase table and RLS expectations.
2. Trace storefront loader: server component or API route that fetches home payload.
3. Add integration test: write draft, publish, read public API or page data.
4. Add admin permission check on save routes (staff role).

## Acceptance criteria

- Unpublished drafts never appear on production storefront.
- Optimistic UI rollback on save failure.

## Rollback

Revert to static home fallback content flag if CMS write broken.
