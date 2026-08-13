# ADR Plan — Breadcrumb JSON-LD on PDP

| **Status** | Accepted |
| **Gap #** | 5 |

## Context

`buildJsonLdBreadcrumb` exists in `seo.ts` but PDP does not output `BreadcrumbList` script.

## Decision

Emit second JSON-LD block on PDP: Home → category (if known) → product.

## Concrete plan

1. Pass category handle or name from PDP loader for middle crumb.
2. Use `canonicalUrl` for hrefs.
3. Validate combined Product + BreadcrumbList in Rich Results tool.

## Acceptance criteria

- PDP HTML contains `BreadcrumbList` with correct order and URLs.
