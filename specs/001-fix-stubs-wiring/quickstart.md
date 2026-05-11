# Quickstart: Stabilize Unfinished Commerce Flows

## Goal

Use this feature lane to find and repair unfinished, mismatched, or half-wired commerce behavior without introducing new architecture.

## Core Verification Loop

1. Identify a broken route, stubbed path, or validation mismatch.
2. Add or update the smallest meaningful regression check around that behavior.
3. Implement the local repair in the owning module.
4. Re-run the targeted verification for that path.
5. Re-run broader repo checks before claiming completion.

## Representative Validation Commands

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:e2e:critical
```

## Representative Investigation Targets

- Storefront routes under `apps/storefront/src/app/(public)` and API endpoints under `apps/storefront/src/app/api`
- Admin flows under `apps/admin/src/app` and `apps/admin/src/features`
- Medusa handlers and workflows under `apps/medusa/src/api`, `apps/medusa/src/modules`, and `apps/medusa/src/workflows`
- Shared logic under `packages/validation`, `packages/sdk`, and related packages

## Completion Signal

The feature is ready to close when repaired paths are traceable, validated, and no longer rely on ambiguous placeholder behavior.

## Deferred Unsupported Paths

- No intentionally deferred unsupported paths are introduced by the completed admin lookup, storefront checkout, POS commit-sale, validation, or J&T dedup slices.
- If a future stabilization pass must leave a touched path incomplete, record the path, explicit failure mode, and owner here before closing the feature.
