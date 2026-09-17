# Dogfood visual screenshots

- **Run:** from project root, `pnpm dogfood:screenshots`
- **Output:** `stress-test/dogfood-output/screenshots/*.png` (full-page PNGs)
- **Storefront:** `visual-screenshots.spec.ts` covers public routes including PDP `/shop/shorts` (Medusa seed handle `shorts`, same as smoke tests).
- **Admin:** `admin-visual-screenshots.spec.ts` uses `http://127.0.0.1:3000`. Admin routes require Google OAuth through Supabase Auth; unauthenticated runs capture the sign-in UI (not the dashboard). To capture the signed-in dashboard, add a Playwright `storageState` from a manual login and pass `--storage-state=...` (optional follow-up).

Playwright starts the unified web app (3000), API (4000), and Medusa (9000) unless `PLAYWRIGHT_SKIP_WEBSERVER` is set and those URLs already respond.
