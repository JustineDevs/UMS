# ADR Plan — Sitemap product URLs

| **Status** | Accepted |
| **Gap #** | 2 |

## Context

`sitemap.ts` omits Medusa product slugs.

## Decision

Paginate Medusa Store or Admin product list in the sitemap generator; emit `/shop/[slug]` with `lastModified` from `updated_at`.

## Concrete plan

1. Server-only fetch in `sitemap.ts` using existing Medusa URL and token pattern used elsewhere in storefront server code.
2. Cap URL count per Google limits; split sitemap index if needed later.
3. Test: sitemap includes at least one known product slug.

## Acceptance criteria

- New products appear in sitemap after deploy without manual edit.
