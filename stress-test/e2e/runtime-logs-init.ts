import { test } from "@playwright/test";
import { attachFullBrowserRuntimeLog, detachBrowserRuntimeLog } from "./helpers/artifacts";

let registered = false;

/**
 * Idempotent: safe to import from multiple helpers / entry specs.
 * Registers global beforeEach/afterEach so every UI test gets `browser-runtime.log`
 * under that test's Playwright output directory.
 */
export function ensureBrowserRuntimeLogs(): void {
  if (registered) {
    return;
  }
  registered = true;

  test.beforeEach(async ({ page }, testInfo) => {
    if (process.env.E2E_BROWSER_RUNTIME_LOG === "0") {
      return;
    }
    attachFullBrowserRuntimeLog(page, testInfo);
  });

  test.afterEach(async ({ page }) => {
    try {
      detachBrowserRuntimeLog(page);
    } catch {
      /* page may already be closed */
    }
  });
}

ensureBrowserRuntimeLogs();
