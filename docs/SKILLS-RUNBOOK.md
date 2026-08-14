# Skills runbook (repo root `skills-lock.json`)

`skills-lock.json` pins skill packages by GitHub source and hash. This repo does not vendor `.agent/skills/*`; use the lock file as the registry of what the agent should load for a given task.

| Skill (lock key) | Typical use | Local run / artifact |
|------------------|------------|------------------------|
| `e2e-testing` | Playwright, POM, CI | `pnpm test:e2e` (repo root) |
| `dogfood` | Exploratory QA, screenshots | `stress-test/dogfood-output/` + `agent-browser` |
| `design-with-taste` | UI feel, motion, one primary action | `stress-test/checklist.md` + storefront `globals.css` |
| `core-engineering` | OOP, SOLID, clean code | `stress-test/checklist.md` |
| `owasp-security` | OWASP, dependency audit | `pnpm stress-test` (audit phase) |
| *stress-test (all)* | Full test suite (lint, security, audit, unit, E2E, dogfood) | `pnpm stress-test` or `pnpm stress-test:quick` (skip E2E/dogfood) |
| `ui-ux-pro-max` | Favicon / touch-icon / manifest sizing | `apps/storefront/public/icons/*`, regenerate: `pnpm --filter @universal-music-store/storefront generate:icons` (source: `public/Universal Music Store Logo Design (abstract).png` at repo root if present) |
| `building-with-medusa` | Medusa backend, workflows, modules | `apps/medusa`; program: `MEDUSA-MIGRATION-PROGRAM.md`; PH seed + import: `pnpm seed:ph`, `pnpm import:legacy-catalog`, `pnpm import:legacy-inventory` (from `apps/medusa`, see app `README.md`) |
| `context-engineering` | Token-efficient prompts, XML bundles, SoT, `[RULE_*]` | Repo templates: [`.cursor/context/README.md`](../.cursor/context/README.md); skill: `.cursor/skills/context-engineering/SKILL.md` |

Install or update locked skills with your org’s skill installer; verify hashes against `skills-lock.json` after updates.
