# universal-music-store-commit CLI

This CLI remains in the repository as an implementation detail for security scanning and historical commit tooling.

The standard repo-level commit command is:

```bash
pnpm run commit:sh
```

The CLI is still used directly for:

```bash
pnpm run security:check
node scripts/commit/cli/index.js linear
```

Use it only when you specifically need a direct security scan or the Linear trailer helper.
