# Scripts — how to use

Run every command from the **repository root** (`E-commerce Website/`).

**Runtime logs:** Most scripts here tee stdout and stderr to `stress-test/test-results/runtime-logs/scripts/<script-name>-<timestamp>.log` (ignored by git). Playwright runs use `stress-test/scripts/run-e2e.js`, which also writes per-run logs under `stress-test/test-results/runtime-logs/<runId>/` (see `stress-test/e2e/README.md`). Set `STRESS_TEST_NO_RUNTIME_LOG=1` to disable the script tee.

---

## `check-audit-triage.js`

**Purpose:** Runs `pnpm audit --json` and enforces policy: **critical** vulnerabilities fail the check. **High** issues must be documented in the active security runbook (or fixed).

**When to use:** Before a release, or when CI / `release-gate` fails on audit.

```bash
node stress-test/scripts/check-audit-triage.js
```

**If it fails:**

1. Fix critical issues, or
2. For high findings you accept for now: add/update the security runbook with explicit **ACCEPT** or **FIX** rows and enough detail (the script requires a substantive doc: length plus ACCEPT/FIX/CVE/high-severity wording when highs remain).

---

## `kill-project-ports.js`

**Purpose:** Frees ports **3000** (storefront), **3001** (admin), **4000** (API), **9000** (Medusa). Helps when a previous `pnpm dev` left orphan Node processes (common on Windows).

**When to use:** `EADDRINUSE`, “port already in use”, or stale servers after closing the terminal.

```bash
pnpm kill-ports
# or
node stress-test/scripts/kill-project-ports.js
```

Then start dev again: `pnpm dev`.

---

## `release-gate.js`

**Purpose:** Pre-ship checks: **lint**, **build** (Turbo), **security:check**, **audit triage**, **test**. Optional **E2E** with a flag.

**Requirements:** **Node 20** (matches `.nvmrc` if present). Wrong Node version exits with an error.

**When to use:** Before merging or deploying; stricter than “lint only” because it includes `pnpm build`.

```bash
# Default: no E2E (faster; E2E step is skipped)
pnpm release-gate

# Full: same gates + Playwright E2E (ensure apps are up if your tests need them)
pnpm release-gate:full
# same as:
node stress-test/scripts/release-gate.js --include-e2e
```

**If a step fails:** Fix the failing step (lint, build, security, audit triage, tests, or E2E) and re-run.

---

## `check-test-runtime.cjs`

**Purpose:** Fast-fails test commands when the shell is using the wrong Node major or native bindings from the wrong OS install (for example Windows-installed `esbuild` or `@swc/core` inside WSL/Linux).

**When to use:** Automatically from app `pretest` scripts and the Medusa Jest wrapper. Run manually when stress or release commands fail before the tests even start.

```bash
node stress-test/scripts/check-test-runtime.cjs esbuild
node stress-test/scripts/check-test-runtime.cjs swc
```

**If it fails:** Switch to **Node 20** and reinstall dependencies inside the current runtime/OS before rerunning tests.

---

## `run-e2e.js`

**Purpose:** Runs Playwright with cache and temp directories under `stress-test/` so Playwright does not write under system install paths (reduces permission errors in some setups).

**When to use:** Local E2E runs, or when `release-gate:full` / `stress-test` runs the E2E phase.

```bash
node stress-test/scripts/run-e2e.js
```

**Extra arguments** are forwarded to Playwright:

```bash
node stress-test/scripts/run-e2e.js path/to/spec.ts
node stress-test/scripts/run-e2e.js dogfood --project=chromium
```

If your suite expects storefront/admin/API/Medusa, start `pnpm dev` (or the stack your tests document) before running E2E.

---

## `stress-test.js`

**Purpose:** Longer QA pass than `release-gate`: **lint**, **security**, **audit triage** (`check-audit-triage.js`, same policy as release-gate), **test**, **E2E**, and optional **dogfood** (screenshot-style Playwright project). Good for a full local “everything” run.

**When to use:** Before a big release or when you want lint + security + audit + tests + E2E + dogfood in one go.

```bash
pnpm stress-test
```

**Skip phases** (faster or when something is not set up):

| Flag | Skips |
|------|--------|
| `--no-lint` | ESLint |
| `--no-security` | Sensitive-files check |
| `--no-audit` | Audit triage (`check-audit-triage.js`) |
| `--no-test` | Unit / integration / Medusa tests |
| `--no-e2e` | Playwright |
| `--no-dogfood` | Dogfood screenshots |

```bash
pnpm stress-test:quick    # same as --no-e2e --no-dogfood
node stress-test/scripts/stress-test.js --no-e2e --no-dogfood
```

E2E and dogfood usually need the dev stack running unless your Playwright config starts servers for you.

---

## Quick comparison

| Goal | Command |
|------|---------|
| Unstick ports | `pnpm kill-ports` |
| Audit policy / triage only | `node stress-test/scripts/check-audit-triage.js` |
| Ship checklist (lint + build + security + audit + tests) | `pnpm release-gate` |
| Same + E2E | `pnpm release-gate:full` |
| Maximum local QA (includes audit phase + E2E + dogfood) | `pnpm stress-test` |
| Playwright only (with project-local cache) | `node stress-test/scripts/run-e2e.js` |

**See also:** root [`package.json`](../../package.json) for `dev`, `test`, `lint`, `build`, and script aliases.
