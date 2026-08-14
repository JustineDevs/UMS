# Stress-test checklist

Manual review items aligned with **design-with-taste**, **core-engineering**, and **OWASP-security** skills. Use after automated phases complete.

## Design with Taste

- [ ] **Simplicity**: One primary action per view; no feature dumps
- [ ] **Fluidity**: Transitions animate (no instant show/hide); directional consistency
- [ ] **Delight**: Selective emphasis; micro-interactions where appropriate
- [ ] **Progressive disclosure**: Trays/sheets over full-page navigation where appropriate

## Core engineering

- [ ] **SOLID**: Single responsibility, open/closed, dependency inversion
- [ ] **DRY / KISS / YAGNI**: No unnecessary abstraction
- [ ] **Encapsulation**: Internal state protected; public API clear

## OWASP / security

- [ ] **Injection**: Inputs sanitized; parameterized queries
- [ ] **Auth**: Session handling; no credentials in logs/URLs
- [ ] **Sensitive data**: No `.env.local` in git; secrets in env vars only

---

_Automated: `pnpm stress-test` runs lint, security check, audit, unit tests, E2E, dogfood._
