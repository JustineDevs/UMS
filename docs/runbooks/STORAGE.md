# Local Storage Maintenance

The repository does not delete Docker volumes, databases, credentials, or source
files automatically. Generated outputs and package caches are cleaned explicitly.

## Inspect

```bash
pnpm storage:report
du -xhd1 . | sort -h
```

`pnpm storage:report` is a dry run. It reports only generated repository output
that is safe to recreate.

## Clean Generated Output

```bash
pnpm storage:prune
```

This removes local Next.js, Medusa, Turbo, test, coverage, and development
runtime output. It does not remove `node_modules`, database volumes, or source.

## Package Caches

Do not prune the global pnpm store or package-manager caches as routine project
maintenance. They are shared across repositories and may need to be downloaded
again. If disk pressure requires cache cleanup, first inspect the exact cache
path and size, then use the package manager's supported prune command only for
unreferenced package content. Never remove active tool installations, project
dependencies, databases, credentials, or user uploads as a side effect.

## Development Rules

- Do not commit build output, test reports, screenshots, or trace archives.
- Stop stale dev servers with `pnpm cleanup:dev` before starting another stack.
- Do not run multiple full repository builds in parallel.
- The app backend runs on Cloudflare Workers; local Docker is only needed when
  the `act` workflow emulator requires it, not to run or deploy the application.
- Act is an explicit CI emulator, not part of `pnpm dev` or `pnpm ci:preflight`.
  The checked-in `.actrc` binds the workspace instead of copying it into a
  container, removes completed containers, and caps each job at 4 GiB RAM, 2
  CPUs, and 512 processes. Run it only for the workflow you need; do not run
  Act, a full build, and the dev stack concurrently.
- `ci:preflight` runs one Turbo task at a time and caps each Node child at
  1536 MiB by default. `UVS_CI_MAX_OLD_SPACE_MB` may raise the cap on a larger
  machine, but values below 1536 MiB are rejected because the cold web
  TypeScript graph can exceed 1 GiB. `UVS_CI_CONCURRENCY` is bounded to 1-4.
