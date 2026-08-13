# ADR Plan PH-12 — CMS experiments (implement or remove)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 12 |
| **Tier** | T3 Medium |

## Context

`CmsExperimentsManager.tsx` manages experiment rows. Without storefront assignment and metrics pipeline, the UI is non-functional experimentation theater.

## Decision (target state)

**Either** ship bucketing middleware or edge logic that reads active experiments and assigns variants with impression logging, **or** remove Experiments from CMS navigation until ready.

## Concrete plan

1. Define minimal assignment: cookie or signed header with variant key per `experiment_key`.
2. Storefront layout reads variant and swaps component props or CMS slice.
3. Wire conversion event hook to existing analytics if present.
4. If removing: delete manager route, drop unused API, migrate DB optional cleanup.

## Acceptance criteria

- Impressions increment only on real page views (bot filter optional phase 2).
- No experiment row can500 the storefront if misconfigured; fail closed to control.

## Rollback

Disable `active` flag in DB for all experiments.
