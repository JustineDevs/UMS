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
  // Shell-provided CI/E2E values must win over local defaults, especially callback origins.
  loadEnv({ path: rootEnvLocal, override: false });
}

/** Shared with storefront webServer so invalidation integration tests match the running app. */
if (!process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim()) {
  process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET =
    "playwright-e2e-invalidation-secret";
}

function boundedNodeOptions(heapMb: number): string {
  const existing = (process.env.NODE_OPTIONS ?? "")
    .replace(/(?:^|\s)--max-old-space-size=\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${existing} --max-old-space-size=${heapMb}`.trim();
}

/**
 * Admin and storefront share one web origin. Route-specific auth remains enforced by middleware.
 */
function storefrontInvalidationSecretForE2E(): string {
  return (
    process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim() ||
    "playwright-e2e-invalidation-secret"
  );
}

const useProductionWebServer = process.env.PLAYWRIGHT_SERVER_MODE === "production";

function storefrontServerEnv(): Record<string, string | undefined> {
  const inv = storefrontInvalidationSecretForE2E();
  return {
    ...process.env,
    NODE_ENV: useProductionWebServer ? "production" : "development",
    NODE_OPTIONS: boundedNodeOptions(
      useProductionWebServer
        ? Number(process.env.PLAYWRIGHT_PRODUCTION_WEB_HEAP_MB || 1024)
        : 2048,
    ),
    NEXT_PUBLIC_SITE_URL:
      baseURL,
    // Keep the embedded CMS preview on the exact same host as the parent
    // page. CSP frame-src is intentionally same-origin in local E2E runs.
    NEXT_PUBLIC_STOREFRONT_URL: baseURL,
    PUBLIC_STOREFRONT_URL: baseURL,
    // The browser app must exercise the local Worker that Playwright starts;
    // inheriting a developer's deployed API_URL makes ownership/security tests
    // nondeterministic and can return provider failures instead of assertions.
    API_URL:
      process.env.PLAYWRIGHT_WORKER_URL ??
      `http://127.0.0.1:${workerPort}`,
    // Allows the built local server to use the repository's deterministic QA
    // identity. This marker is never set by Vercel and is not a production
    // authentication control.
    UVS_E2E_LOCAL: process.env.UVS_E2E_LOCAL,
    // Explicitly forward local staff-E2E credentials to the spawned Next
    // process. The config loads `.env.local` in the Playwright process, but
    // relying on an inherited dotenv merge makes the production artifact
    // intermittently render the disabled `/sign-in/e2e` state.
    E2E_ADMIN_AUTH: process.env.E2E_ADMIN_AUTH,
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
    UVS_E2E_REAL_SESSION: process.env.UVS_E2E_REAL_SESSION,
    ADMIN_ALLOWED_EMAILS: process.env.ADMIN_ALLOWED_EMAILS,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISABLED: process.env.AUTH_DISABLED,
    AUTH_DISABLE: process.env.AUTH_DISABLE,
    STOREFRONT_INTERNAL_INVALIDATION_SECRET: inv,
    // Survives if dotenv clears the primary key; route reads this in invalidate-commerce-state
    __PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET: inv,
    // The CMS editor's cold compile legitimately needs the E2E heap budget.
    // run-next-dev.cjs uses this explicit override while keeping ordinary
    // developer sessions at their lower bounded default.
    UVS_DEV_WEB_MAX_OLD_SPACE_MB: useProductionWebServer
      ? undefined
      : process.env.UVS_DEV_WEB_MAX_OLD_SPACE_MB ?? "3072",
  };
}

/**
 * Default `127.0.0.1` avoids `ECONNREFUSED ::1` on Windows when Next binds IPv4 only.
 * Override with PLAYWRIGHT_BASE_URL when needed.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const tunnelBypass = process.env.PLAYWRIGHT_TUNNEL_BYPASS?.trim();

/**
 * Playwright treats the server as "already up" only when this URL returns 2xx–3xx (<404).
 * The storefront home page can be 404/500 during compile or misconfig; `/api/health` stays stable JSON 200.
 */
const storefrontWebServerUrl =
  process.env.PLAYWRIGHT_STOREFRONT_WEBSERVER_URL ??
  new URL("/api/health", baseURL).toString();
const workerPort = process.env.CLOUDFLARE_DEV_PORT ?? "8787";

const reuseDevServer = !process.env.CI && !useProductionWebServer;
const configuredWorkers = Number(
  process.env.PLAYWRIGHT_WORKERS || (process.env.CI ? 2 : 1),
);
if (!Number.isInteger(configuredWorkers) || configuredWorkers < 1) {
  throw new Error("PLAYWRIGHT_WORKERS must be a positive integer");
}

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
  fullyParallel: process.env.PLAYWRIGHT_FULLY_PARALLEL === "1",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: configuredWorkers,
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
    ...(tunnelBypass
      ? { extraHTTPHeaders: { "bypass-tunnel-reminder": tunnelBypass } }
      : {}),
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
          command:
            `pnpm exec wrangler dev --config wrangler.jsonc --env dev --local --show-interactive-dev-session=false --port ${workerPort}`,
          url: process.env.PLAYWRIGHT_WORKER_URL ?? `http://127.0.0.1:${workerPort}/healthz`,
          reuseExistingServer: reuseDevServer,
          timeout: 180_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            NODE_ENV: "development",
            CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_MEDUSA_HYPERDRIVE:
              process.env.MEDUSA_DB_URL ?? "",
            CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_APP_HYPERDRIVE:
              process.env.APP_DB_URL ?? "",
          },
        },
        {
          command: useProductionWebServer
            ? "pnpm --filter @universal-music-store/web exec next start --hostname 127.0.0.1 --port 3000"
            : "pnpm --filter @universal-music-store/web dev",
          url: storefrontWebServerUrl,
          // Critical release proof serves the already-built artifact. Normal
          // developer runs can reuse `pnpm dev`; set PLAYWRIGHT_SKIP_WEBSERVER=1
          // for a fully external stack.
          reuseExistingServer: reuseDevServer,
          timeout: 240_000,
          stdout: "pipe",
          stderr: "pipe",
          env: storefrontServerEnv(),
        },
      ],
  /** Per-test ceiling must exceed PDP / shop waits (see stress-test/e2e/helpers/storefront.ts). */
  timeout: 180_000,
});
