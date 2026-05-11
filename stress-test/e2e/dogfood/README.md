# Dogfood visual screenshots

- **Run:** from project root, `pnpm dogfood:screenshots`
- **Output:** `stress-test/dogfood-output/screenshots/*.png` (full-page PNGs)
- **Storefront:** `visual-screenshots.spec.ts` covers public routes including PDP `/shop/shorts` (Medusa seed handle `shorts`, same as smoke tests).
- **Admin:** `admin-visual-screenshots.spec.ts` uses `http://localhost:3001`. Admin routes require Google OAuth; unauthenticated runs capture the **NextAuth sign-in** UI (not the dashboard). To capture the signed-in dashboard, add a Playwright `storageState` from a manual login and pass `--storage-state=...` (optional follow-up).

Playwright starts API (4000), storefront (3000), and admin (3001) unless `PLAYWRIGHT_SKIP_WEBSERVER` is set and those URLs already respond.
