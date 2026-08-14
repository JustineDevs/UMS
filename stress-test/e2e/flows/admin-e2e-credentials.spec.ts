import { test } from "@playwright/test";
import { e2eAdminLogin } from "../helpers/admin-e2e-auth";

/**
 * Staff dashboard via E2E credentials. Same env as production admin: first email in
 * ADMIN_ALLOWED_EMAILS and NEXTAUTH_SECRET as password; run pnpm e2e:ensure-staff once
 * (creates user, staff role, and `*` permission grants for full admin-route E2E).
 */
test.describe("Admin E2E credentials", () => {
  test("staff reaches /admin after E2E credential sign-in", async ({
    page,
  }) => {
    const result = await e2eAdminLogin(page);
    if (result === "skip_no_ui") {
      test.skip(
        true,
        "E2E credentials UI not available (use /sign-in/e2e in development with ADMIN_ALLOWED_EMAILS + NEXTAUTH_SECRET). Run pnpm e2e:ensure-staff for Supabase user.",
      );
    }
    if (result === "skip_no_env") {
      test.skip(
        true,
        "Set ADMIN_ALLOWED_EMAILS and NEXTAUTH_SECRET in root .env.local for Playwright (loaded by playwright.config).",
      );
    }
  });
});
