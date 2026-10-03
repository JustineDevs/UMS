import { test, expect } from "@playwright/test";

import {
  runGuestCheckoutShellWorkflow,
  exerciseCheckoutAddressFields,
} from "./checkout-full.workflow";
import { assertStorefrontHealth } from "./storefront-journeys.workflow";
import { strictCatalog } from "../fixtures/env";
import { attachConsoleListener, detachConsoleListener, assertNoUnexpectedConsole } from "../helpers/artifacts";

test.describe.configure({ mode: "parallel" });

test.describe("@workflow @checkout full guest checkout harness (shell + affordances)", () => {
  test("health + PDP path + checkout + optional address + console hygiene", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const issues: { type: "error" | "warning"; text: string }[] = [];
    attachConsoleListener(page, issues);
    try {
      await assertStorefrontHealth(request);
      const result = await runGuestCheckoutShellWorkflow(page);
      if (!result.reachedPdp && strictCatalog()) {
        throw new Error("Strict E2E requires catalog.");
      }
      await exerciseCheckoutAddressFields(page);
      void result.paymentTogglesFound;
    } finally {
      detachConsoleListener(page);
    }
    assertNoUnexpectedConsole(issues, 2);
  });
});
