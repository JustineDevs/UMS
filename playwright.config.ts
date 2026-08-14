import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * http-flow scripts often set `PLAYWRIGHT_SKIP_WEBSERVER=1` in `.env.local`. That must not disable
 * `webServer` when you run `pnpm exec playwright test` without exporting the var in the shell,
 * or every API test gets `ECONNREFUSED` on 3000/9000. Only a shell-exported skip wins.
 */
const shellPlaywrightSkipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER;

process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
/** Match `scripts/load-monorepo-root-env.cjs`: `.env.local` only. */
const rootEnvLocal = resolve(process.cwd(), ".env.local");
if (existsSync(rootEnvLocal)) {
  loadEnv({ path: rootEnvLocal, override: true });
}

/** Shared with storefront webServer so invalidation integration tests match the running app. */
if (!process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim()) {
  process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET =
    "playwright-e2e-invalidation-secret";
}

/**
 * Root `.env.local` often sets NODE_ENV=production for deploy docs. `next dev` must run as
 * development or it looks for `.next/required-server-files.json` and fails with ENOENT.
 */
function nextDevServerEnv(): NodeJS.ProcessEnv {
  return { ...process.env, NODE_ENV: "development" };
}

/**
 * Root `.env.local` usually sets NEXTAUTH_URL to the storefront (3000). Admin on 3001 must use
 * its own URL or NextAuth cookies/session never match and sign-in stays on /sign-in.
 */
function storefrontInvalidationSecretForE2E(): string {
  return (
    process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim() ||
    "playwright-e2e-invalidation-secret"
  );
}

function storefrontDevServerEnv(): NodeJS.ProcessEnv {
  const inv = storefrontInvalidationSecretForE2E();
  return {
    ...process.env,
    NODE_ENV: "development",
    NEXTAUTH_URL:
      process.env.PLAYWRIGHT_STOREFRONT_NEXTAUTH_URL ?? "http://localhost:3000",
    STOREFRONT_INTERNAL_INVALIDATION_SECRET: inv,
    // Survives if dotenv clears the primary key; route reads this in invalidate-commerce-state
    __PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET: inv,
  };
}

function adminDevServerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "development",
    NEXTAUTH_URL: process.env.PLAYWRIGHT_ADMIN_NEXTAUTH_URL ?? "http://localhost:3001",
  };
}

/**
 * Default `127.0.0.1` avoids `ECONNREFUSED ::1` on Windows when Next binds IPv4 only.
 * Override with PLAYWRIGHT_BASE_URL when needed.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Playwright treats the server as "already up" only when this URL returns 2xx–3xx (<404).
 * The storefront home page can be 404/500 during compile or misconfig; `/api/health` stays stable JSON 200.
 */
const storefrontWebServerUrl =
  process.env.PLAYWRIGHT_STOREFRONT_WEBSERVER_URL ??
  new URL("/api/health", baseURL).toString();

const reuseDevServer = !process.env.CI;

const skipPlaywrightWebServer =
  shellPlaywrightSkipWebServer === "1" || shellPlaywrightSkipWebServer === "true";

const e2eTrace =
  process.env.E2E_TRACE === "all" || process.env.E2E_TRACE === "on"
    ? ("on" as const)
    : process.env.E2E_TRACE === "off"
      ? ("off" as const)
      : ("retain-on-failure" as const);

export default defineConfig({
  testDir: "./stress-test/e2e",
  outputDir: "./stress-test/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "stress-test/playwright-report" }],
    ["list"],
    [
      "./stress-test/e2e/reporters/test-artifact-reporter.ts",
      { outputBase: process.env.E2E_RUNTIME_LOG_DIR },
    ],
  ],
  use: {
    baseURL,
    trace: e2eTrace,
    screenshot: "only-on-failure",
    video: "off",
    /** Catalog + cold Next compile can exceed 60s under parallel load; helpers wait up to 90s for PDP. */
    navigationTimeout: 120_000,
    actionTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/storefront-api-security-rate-limit.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-rate-limit",
      testMatch: "**/storefront-api-security-rate-limit.spec.ts",
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: skipPlaywrightWebServer
    ? undefined
    : [
        {
          command: "pnpm --filter medusa dev",
          url: process.env.PLAYWRIGHT_MEDUSA_URL ?? "http://localhost:9000/health",
          reuseExistingServer: reuseDevServer,
          timeout: 180_000,
          stdout: "pipe",
          stderr: "pipe",
        },
        {
          command: "pnpm --filter @universal-music-store/api dev",
          url: process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000/health",
          reuseExistingServer: reuseDevServer,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ?? "e2e-internal-key",
          },
        },
        {
          command: "pnpm --filter @universal-music-store/storefront dev",
          url: storefrontWebServerUrl,
          /**
           * Do not reuse a manually started storefront: it often lacks
           * `STOREFRONT_INTERNAL_INVALIDATION_SECRET`, which breaks commerce invalidation HTTP tests.
           * Free port 3000 before running Playwright, or set `PLAYWRIGHT_SKIP_WEBSERVER=1` and align `.env.local`.
           */
          reuseExistingServer: false,
          timeout: 240_000,
          stdout: "pipe",
          stderr: "pipe",
          env: storefrontDevServerEnv(),
        },
        {
          command: "pnpm --filter @universal-music-store/admin dev",
          url: "http://localhost:3001",
          reuseExistingServer: reuseDevServer,
          timeout: 240_000,
          stdout: "pipe",
          stderr: "pipe",
          env: adminDevServerEnv(),
        },
      ],
  /** Per-test ceiling must exceed PDP / shop waits (see stress-test/e2e/helpers/storefront.ts). */
  timeout: 180_000,
});
