# ADR Plan — Shop rel=prev / rel=next

| **Status** | Accepted |
| **Gap #** | 6 |

## Context

Shop uses `export const metadata` static; pagination uses `offset` query.

## Decision

Replace or supplement with `generateMetadata` async using `searchParams` to compute prev and next absolute URLs.

## Concrete plan

1. Compute total pages or has-next from catalog fetch.
2. Set `alternates` or Next `other` metadata keys supported for link rel (Next 15 patterns).
3. Manual verify page 2 head tags.

## Acceptance criteria

- Page 2 lists `rel="prev"` to page 1; intermediate pages have both prev and next when applicable.
