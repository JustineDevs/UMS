# Dependency Audit Triage

Generated from the production readiness pass on 2026-08-10 and refreshed on
2026-09-29. This document is deliberately explicit: a triaged advisory is not
the same as a fixed advisory.
The release workflow fails on any production high or critical advisory.

## Current status

- Critical production advisories: 0.
- High production advisories: 0.
- Moderate production advisories: 1.
- Low production advisories: 1.
- Full-workspace audit: 0 high, 1 moderate, 1 low. The additional
  non-production findings are triaged separately from the production audit.
- The prior high findings were transitive `path-to-regexp` and
  `brace-expansion` resolutions. Compatible package-manager resolutions now
  preserve Express 4's parser contract and use patched dependency lines.
- `react-router` has a resolver/peer mismatch in the workspace: the resolved
  optional package is 8.x while the applications use React 18. This must be
  resolved by upgrading the owning dependency or retaining its compatible
  major, not by suppressing the peer warning.

## Actions

- FIXED: Next.js upgraded to the patched 15.5.21 line.
- FIXED: next-auth upgraded to the patched 4.24.15 line.
- FIXED: protobufjs and tar are pinned to patched lines through workspace
  overrides.
- FIXED: the SBOM workflow no longer ignores audit or license failures.
- VERIFIED: no high or critical production advisory remains after compatible
  dependency resolutions. One moderate and one low full-workspace finding
  remain for dependency-owner review.

## Quality scans

- React Doctor: 0 source errors, 217 warnings; generated `.next-dev` source
  maps are excluded from the source scan. The warning budget is 286.
- Knip: clean under the current `knip.json` workspace configuration.

## Ship decision

`pnpm audit --prod --audit-level high` is green. Unqualified production
shipment remains conditional on resolving the React Router peer mismatch,
reviewing the remaining moderate/low findings, and completing hosted/browser
and external-integration proof.
