# ADR Plan PH-09 — CMS page blocks editor

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 9 |
| **Tier** | T2 High |

## Context

`CmsPageBlocksEditor.tsx` edits rich page blocks for CMS pages. Block types must serialize safely and render on storefront.

## Decision (target state)

Add, remove, reorder, and change block types persist atomically per save; validation rejects unknown block shapes at API.

## Concrete plan

1. Define Zod or shared schema in `packages/validation` for block union types.
2. Admin API validates payload before Supabase upsert.
3. Storefront renderer switches on block type with safe fallbacks.
4. E2E: edit page, assert public slug renders new block order.

## Acceptance criteria

- Invalid JSON from editor never500s the API; returns field errors.
- Reorder persists order index stable under concurrent edits (optional version column).

## Rollback

Disable block types not yet rendered; show maintenance message on storefront for those slugs.
