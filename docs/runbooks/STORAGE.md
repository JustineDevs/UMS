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
