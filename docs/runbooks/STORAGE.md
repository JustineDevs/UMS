# Local Storage Maintenance

The repository does not delete Docker volumes, databases, credentials, or source
files automatically. Generated outputs and package caches are cleaned explicitly.

## Inspect

```bash
pnpm storage:report
du -xhd1 . | sort -h
docker system df
```

`pnpm storage:report` is a dry run. It reports only generated repository output
that is safe to recreate.

## Clean Generated Output

```bash
pnpm storage:prune
```

This removes local Next.js, Medusa, Turbo, test, coverage, and development
runtime output. It does not remove `node_modules`, database volumes, or source.

## Package and Docker Caches

Run these only when the report confirms the machine is under storage pressure:

```bash
pnpm store prune
npm cache clean --force
docker builder prune -af
```

Do not run `docker volume prune` automatically. Local volumes may contain
PostgreSQL, Redis, or Neo4j data. Remove unused images with `docker image prune
-af` only after confirming they are not needed by an active local workflow.

## Development Rules

- Do not commit build output, test reports, screenshots, or trace archives.
- Stop stale dev servers with `pnpm cleanup:dev` before starting another stack.
- Do not run multiple full repository builds in parallel.
- Keep Docker build contexts bounded by `.dockerignore`.
