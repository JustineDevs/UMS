# Git Commit Automation Guide

The canonical repository commit path is:

```bash
pnpm run commit:sh
```

This runs the security-checked parallel Bash commit flow in `scripts/commit/parallel-commit.sh`.

## What It Does

1. Scans modified, added, and deleted files
2. Blocks sensitive files through the shared security rules
3. Generates commit messages from diff content
4. Commits files in parallel batches

## Supporting Commands

```bash
pnpm run ci:preflight
pnpm run ci:preflight:full
pnpm run security:check
```

- `pnpm run ci:preflight` runs Turbo `lint`, `typecheck`, and `test`
- `pnpm run ci:preflight:full` adds the repo’s fuller CI-like verification path
- `pnpm run security:check` runs the standalone sensitive-file scan without creating commits

## Recommended Flow

```bash
pnpm run ci:preflight
pnpm run commit:sh
```

## Notes

- The older root script aliases (`commit`, `commit:dry`, `commit:cli`, `commit:sh:dry`, `commit:all`) were removed so the repo advertises one standard commit path.
- The preflight flow no longer references any `services/orchestrator` Python tooling because that directory is not part of this repo.
