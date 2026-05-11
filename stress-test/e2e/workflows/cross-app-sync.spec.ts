import { test, expect } from "@playwright/test";

import { assertCrossAppHttpProbes, assertAdminOrdersShellWhenAuthenticated } from "./cross-app.workflow";

test.describe.configure({ mode: "parallel" });

test.describe("@cross-app @smoke HTTP probes both apps", () => {
  test("storefront health and admin orders route", async ({ request }) => {
    await assertCrossAppHttpProbes(request);
  });
});

test.describe("@cross-app @workflow admin orders shell when staff auth works", () => {
  test("orders list loads after e2e sign-in", async ({ page }) => {
    test.setTimeout(180_000);
    const r = await assertAdminOrdersShellWhenAuthenticated(page);
    if (r === "skip_no_ui" || r === "skip_no_env") {
      test.skip(true, "Configure ADMIN_ALLOWED_EMAILS + NEXTAUTH_SECRET and e2e:ensure-staff.");
    }
    expect(r).toBe("ok");
  });
});
