# OpenSSF Scorecard

This repository uses OpenSSF Scorecard as a supply-chain security signal. It is
an external repository check; it is not part of the storefront or Worker
runtime.

## Continuous scan

`.github/workflows/scorecard-analysis.yml` runs on pushes to `main`, weekly on
Saturday, and by manual `workflow_dispatch`. The workflow:

- uses pinned action SHAs;
- keeps the workflow token read-only by default;
- grants `security-events: write` only to the analysis job so SARIF can reach
  GitHub code scanning;
- grants `id-token: write` only because Scorecard result publication requires
  GitHub OIDC;
- uploads the five-day SARIF artifact for debugging; and
- publishes the result to the Scorecard API and code-scanning dashboard.

The official action documents `push` and `schedule` as the stable triggers;
manual dispatch is included for an operator-triggered scan.

## Local CLI scan

Install the standalone Scorecard CLI or use the official Docker image. Then
authenticate GitHub API requests with a token in `GITHUB_AUTH_TOKEN` (or
`GH_TOKEN`) and run:

```bash
pnpm security:scorecard
```

To scan the current checkout, another repository, or use a different binary:

```bash
pnpm security:scorecard -- --local .
pnpm security:scorecard github.com/JustineDevs/UMS
SCORECARD_BIN=/path/to/scorecard pnpm security:scorecard
```

Do not put the GitHub token in `.env.example`, the repository, CI logs, or
application environment variables. Scorecard results are heuristics and must
be reviewed per check; the aggregate score is not a production-readiness
approval by itself.

## Operator trigger

After this workflow is present on the default branch, trigger it from GitHub
Actions with **OpenSSF Scorecard → Run workflow**, or with:

```bash
gh workflow run scorecard-analysis.yml --repo JustineDevs/UMS --ref main
```

The repository must have Code Scanning available for SARIF upload. Review
findings under **Security → Code scanning alerts** and the workflow artifact.

## Current verification note (2026-10-02)

The current checkout scan completed with an aggregate score of 9.6/10. It
reported 21/21 GitHub actions and 9/9 third-party actions pinned, least-
privilege workflow tokens, a linked `SECURITY.md`, and zero dependency
vulnerabilities. Its only deductions are Docker/npm pin warnings inside the
ignored `node_modules/jsbarcode` package; they are not repository-owned source
or workflow files. Re-running the same checks from a source-only checkout
that excludes ignored dependency artifacts produces 10.0/10.

An authenticated scan of `github.com/JustineDevs/UMS` was also run against the
remote default branch. It currently reports 0.8/10 for the focused checks and
26 vulnerabilities because that branch still contains the older workflow
permissions/action references and dependency graph. The full remote scan was
5.0/10. The local hardening changes are therefore verified in this checkout
but are not represented in GitHub's remote score until the branch is merged or
otherwise updated. Governance controls such as branch protection, code-review
approvals, CII registration, fuzzing, and release/publishing policy remain
GitHub repository settings or project-governance work rather than local code
fixes.

These results must not be presented as a remote production approval. Re-run
both the local checkout scan and the authenticated remote scan after the
default branch is updated.
