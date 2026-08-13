# ADR Plan — Filtered shop canonical

| **Status** | Accepted |
| **Gap #** | 7 |

## Context

Fixed canonical `/shop` while content varies by filters duplicates SEO signals.

## Decision

When any merchandising filter query is present, canonical remains base `/shop` (or documented policy: e.g. category-only canonicals).

## Concrete plan

1. Implement `generateMetadata` reading `searchParams`.
2. If `category`, `color`, `size`, `brand`, `q`, price range, or non-default sort: set `alternates.canonical` to `canonicalUrl("/shop")` or chosen rule.
3. Document policy in `docs/` for SEO team.

## Acceptance criteria

- `?color=blue` page head shows canonical to unfiltered `/shop` per chosen policy.
