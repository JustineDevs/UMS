# CMS A/B experiments: storefront keys

Experiments are stored in Supabase (`cms_ab_experiments`) and exposed to the storefront for anonymous assignment (cookie `cms_ab_[experiment_key]`).

## How the storefront should consume `experiment_key`

1. Load active experiments (respect `starts_at`, `ends_at`, `active`, and optional `traffic_cap_pct`).
2. For each experiment that applies to the current route:
   - If `target_page_slug` is set, only run when the CMS page slug or path matches that value.
   - If `target_component_key` is set, only swap content for that component id in your React tree.
3. Pick a variant using the stored weights (must sum to 1). Persist the chosen variant id in a cookie so the user sees a stable experience.
4. When you add analytics, emit `impression` when the variant renders and `conversion` when the goal fires; map those to the experiment row counters if you extend the API.

## Suggested `experiment_key` names

| Key              | Typical surface                          |
| ---------------- | ---------------------------------------- |
| `hero_copy`      | Homepage hero headline or subcopy        |
| `home_promo_bar` | Thin promo strip under the header        |
| `pdp_upsell`     | Product detail recommendations block     |
| `checkout_cta`   | Checkout secondary call to action      |

Use lowercase snake_case. One active experiment per surface to avoid overlapping assignments.

## `target_component_key` examples

These are conventions for your Next.js app, not enforced in the database:

- `hero_primary_cta`
- `collection_grid_title`
- `footer_newsletter_heading`

The admin UI stores the string; your storefront code branches on it when selecting which subtree reads `variants`.

## Variants JSON shape

Each variant is an object with at least:

- `id` (string): stable identifier stored in the cookie.
- `weight` (number): non-negative; all weights for an experiment should sum to 1.

Additional keys (e.g. `title`, `href`) are passed through to your UI as needed.
