---
name: test
description: Runs and scopes automated tests for this Turborepo (unit, package filters, Medusa stress, E2E, release gate). Use when the user asks to run tests, verify CI locally, debug failing tests, or choose the right test command for a changed package.
---

# Monorepo testing

## Default commands (repo root)

| Goal | Command |
|------|---------|
| Full unit + package test suite (long) | `pnpm test` |
| Stress / gate without full E2E details | `pnpm stress-test:quick` |
| Full stress pipeline | `pnpm stress-test` |
| Playwright E2E | `pnpm test:e2e` (UI: `pnpm test:e2e:ui`) |
| Pre-deploy style check | `pnpm predeploy` |

`pnpm test` runs packages in a fixed order (platform-data, UI build, sdk, validation, rate-limits, api, database, admin, storefront, Medusa unit + Medusa stress). Prefer **scoped** runs when the user only touched one area.

## Scoped runs

Use `pnpm --filter <package-name> test` (or the script defined in that package, e.g. `test:unit`, `test:stress`).

Common filters (from workspace `package.json` names):

- `@universal-music-store/platform-data`
- `@universal-music-store/sdk`
- `@universal-music-store/validation`
- `@universal-music-store/rate-limits`
- `@universal-music-store/api`
- `@universal-music-store/database`
- `@universal-music-store/admin`
- `@universal-music-store/storefront`
- `medusa` (see `apps/medusa/package.json` for `test:unit`, `test:stress`)

Example: only SDK tests:

```bash
pnpm --filter @universal-music-store/sdk test
```

## E2E prerequisites

E2E often needs services and seed data. From root:

- `pnpm e2e:prep` (Medusa prep + staff ensure)
- Then `pnpm test:e2e` or targeted specs via `node stress-test/scripts/run-e2e.js <path-or-pattern>`

Read `playwright.config.ts` and `stress-test/scripts/run-e2e.js` when the user needs custom projects or grep.

## Agent behavior

1. Prefer the **smallest** command that covers the changed code (filter > full `pnpm test`).
2. Run commands from the **repository root** unless the user’s task is package-only and they specify otherwise.
3. On failure: capture the failing package, file, and assertion; suggest rerunning with a single filter.
4. Do not assume E2E passes without prep; mention prep when running E2E for the first time in a session.

## Optional detail

For stress-test flags and dogfood flows, see `.cursor/commands/stress.md` if present in the repo.
