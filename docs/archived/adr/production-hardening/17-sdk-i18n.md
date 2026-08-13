# ADR Plan PH-17 — Shared SDK i18n completeness

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 17 |
| **Tier** | T3 Medium |

## Context

`packages/sdk/src/i18n.ts` supports `registerTranslations` and falls back to key as string. `fil-PH` and `en-US` dictionaries are largely empty while `en-PH` has core keys.

## Decision (target state)

**Either** fill minimum viable keys for all exported locales used in storefront, **or** reduce `SupportedLocale` to only locales you ship and remove dead locale tokens from public API docs.

## Concrete plan

1. Inventory `t("...")` keys across storefront and admin client imports.
2. Add parity tests: every key exists in `en-PH`; `fil-PH` falls back explicitly or equals `en-PH` for missing keys with telemetry in dev.
3. Document locale detection behavior in `AGENTS.md` or storefront README.

## Acceptance criteria

- No user-visible raw i18n keys on production paths for supported locales.
- `formatCurrency` and `formatDate` covered by unit tests for each locale.

## Rollback

Force `DEFAULT_LOCALE` only in env for emergency.
