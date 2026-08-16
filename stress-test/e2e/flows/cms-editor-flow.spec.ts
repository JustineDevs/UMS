import { test, expect } from "@playwright/test";
import { adminBase, e2eAdminLogin } from "../helpers/admin-e2e-auth";

test.describe.configure({ mode: "serial" });

test.describe("@admin CMS canonical editor", () => {
  test.beforeEach(async ({ page }) => {
    const login = await e2eAdminLogin(page);
    if (login === "skip_no_ui" || login === "skip_no_env") {
      test.skip(true, "Admin E2E auth is not configured.");
    }
    await page.goto(`${adminBase}/admin/cms/builder`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[aria-label="Visual page builder"]')).toBeVisible({ timeout: 30_000 });
  });

  test("CMS-01..CMS-04 unified workspace, persisted preview source, and selection", async ({ page }) => {
    await expect(page.getByRole("button", { name: "In context" })).toBeVisible();
    await expect(page.locator('iframe[title="Storefront canvas"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Pages", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Components", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Navigator", exact: true })).toBeVisible();

    const frame = page.locator('iframe[title="Storefront canvas"]').contentFrame();
    const visibleNode = frame.locator('[data-cms-id]:not([hidden])').first();
    await expect(visibleNode).toBeVisible({ timeout: 30_000 });
    await visibleNode.click({ force: true });
    await expect(page.getByRole("button", { name: "Content", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "mobile viewport" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByText("110%", { exact: true })).toBeVisible();
  });

  test("CMS-07..CMS-09 inspector coverage and selection geometry remain stable", async ({ page }) => {
    const frame = page.locator('iframe[title="Storefront canvas"]').contentFrame();
    const selected = frame.locator('[data-cms-id]:not([hidden])').first();
    await expect(selected).toBeVisible({ timeout: 30_000 });
    await selected.click({ force: true });

    for (const tab of ["Style", "Layout", "Responsive", "Advanced", "Code"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.getByRole("button", { name: tab, exact: true })).toHaveClass(/bg-slate-100/);
    }
    await frame.locator("body").evaluate((body) => body.scrollTo(0, body.scrollHeight));
    await page.locator('iframe[title="Storefront canvas"]').evaluate((element) => {
      element.dispatchEvent(new Event("resize"));
      element.contentWindow?.postMessage({ source: "cms-builder", id: "invalid", rect: { x: 0, y: 0, width: -1, height: 0 } }, window.location.origin);
    });
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.locator("body")).not.toContainText(/Maximum update depth|Application error|Unhandled Runtime Error/i);
  });

  test("CMS-05..CMS-08 slots, drag/drop, inspector, and command history", async ({ page }) => {
    await page.getByRole("button", { name: "Components", exact: true }).click();
    const add = page.getByRole("button", { name: /Add Call to action/ }).first();
    await expect(add).toBeVisible();
    await add.click();
    await page.getByRole("button", { name: "Navigator", exact: true }).click();
    await page.getByRole("button", { name: /Hero banner/ }).first().click();
    await page.getByRole("button", { name: "Components", exact: true }).click();
    const dragSource = page.getByTestId("cms-component-drag-cta-row");
    const slotTarget = page.locator('[data-testid^="cms-slot-"][data-testid$="-actions"]').first();
    await expect(slotTarget).toBeVisible();
    const slotItems = slotTarget.getByRole("button", { name: "Call to action", exact: true });
    const initialSlotCount = await slotItems.count();
    await dragSource.dragTo(slotTarget);
    const invalidDrag = page.getByTestId(/cms-component-drag-/).filter({ hasText: /Hero banner/i }).first();
    await invalidDrag.dragTo(slotTarget);
    await expect(page.getByText(/does not allow/i)).toBeVisible();
    await add.click();
    await page.getByRole("button", { name: "Navigator", exact: true }).click();
    await page.getByRole("button", { name: /Hero banner/ }).first().click();
    await page.getByRole("button", { name: "Components", exact: true }).click();
    await dragSource.dragTo(slotTarget);
    await expect(slotItems).toHaveCount(initialSlotCount + 2);
    await slotTarget.getByRole("button", { name: "Move Call to action down" }).first().click();
    await slotTarget.getByRole("button", { name: "Move Call to action up" }).last().click();
    await slotTarget.getByRole("button", { name: "Remove Call to action" }).last().click();
    await expect(slotItems).toHaveCount(initialSlotCount + 1);
    await page.getByRole("button", { name: "Navigator", exact: true }).click();
    await expect(page.getByText("Call to action", { exact: true }).first()).toBeVisible();

    const frame = page.locator('iframe[title="Storefront canvas"]').contentFrame();
    await frame.locator('[data-cms-id^="cms-dom-"][data-cms-block-id]').first().click({ force: true });
    const padding = page.locator("label").filter({ hasText: "padding" }).last().locator("input");
    await expect(padding).toBeVisible();
    await padding.fill("24px");
    await padding.blur();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();
    await page.getByRole("button", { name: "Redo" }).click();
    const save = page.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeVisible({ timeout: 30_000 });
    const saveResponse = page.waitForResponse(
      (response) =>
        (/\/api\/admin\/cms\/pages(?:\/[^/]+)?$/.test(response.url()) ||
          /\/api\/admin\/storefront-home$/.test(response.url())) &&
        ["POST", "PUT"].includes(response.request().method()) &&
        response.status() === 200,
    );
    await save.click();
    await saveResponse;
    await expect(save).toBeEnabled({ timeout: 30_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[aria-label="Visual page builder"]')).toBeVisible({ timeout: 30_000 });
  });

  test("CMS-13 canonical page tree publish and mutation reload", async ({ page }) => {
    await page.getByRole("button", { name: "Navigator", exact: true }).click();
    await page.getByRole("button", { name: "Pages", exact: true }).last().click();
    await expect(page.getByText("Choose a page to open the visual editor.")).toBeVisible();
    await page.getByRole("button", { name: "New page", exact: true }).click();

    const nestedBuilder = page.locator('[aria-label="Visual page builder"]').last();
    await expect(nestedBuilder).toBeVisible({ timeout: 30_000 });
    await nestedBuilder.getByRole("button", { name: "Components", exact: true }).click();
    await nestedBuilder.getByRole("button", { name: /Add Call to action/ }).click();
    const save = nestedBuilder.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeVisible();
    const responsePromise = page.waitForResponse(
      (response) =>
        /\/api\/admin\/cms\/pages(?:\/[^/]+)?$/.test(response.url()) &&
        ["POST", "PUT"].includes(response.request().method()) &&
        response.status() === 200,
    );
    await save.click();
    const saved = await (await responsePromise).json() as {
      data?: { id?: string; slug?: string; status?: string; version?: number; tree?: unknown[]; blocks?: unknown[] };
    };
    expect(saved.data?.id).toBeTruthy();
    expect(saved.data?.tree?.length ?? 0).toBeGreaterThan(0);
    const savedPage = await page.request.get(`${adminBase}/api/admin/cms/pages/${saved.data!.id}`);
    expect(savedPage.ok(), await savedPage.text()).toBeTruthy();
    const persistedTree = [
      ...(saved.data!.tree ?? []),
      { id: "future-browser-node", componentId: "future-component", blockType: "future_block", parentId: null, slot: null, props: { preserved: true }, styles: {}, children: [] },
    ];
    const publish = await page.request.put(`${adminBase}/api/admin/cms/pages/${saved.data!.id}`, {
      headers: { "Idempotency-Key": `cms-publish-${saved.data!.id}-${Date.now()}` },
      data: {
        id: saved.data!.id,
        slug: saved.data!.slug ?? "new-page",
        expectedVersion: saved.data!.version,
        status: "published",
        tree: persistedTree,
        blocks: saved.data!.blocks,
      },
    });
    const publishText = await publish.text();
    const publishBody = publishText.startsWith("{")
      ? JSON.parse(publishText) as { data?: { status?: string }; error?: string }
      : { error: publishText.slice(0, 160) };
    expect(publish.ok(), JSON.stringify(publishBody)).toBeTruthy();
    expect(publishBody.data?.status).toBe("published");
    const reloaded = await page.request.get(`${adminBase}/api/admin/cms/pages/${saved.data!.id}`);
    const reloadedBody = await reloaded.json() as { data?: { tree?: Array<{ id?: string; componentId?: string; props?: Record<string, unknown> }> } };
    const unknown = reloadedBody.data?.tree?.find((node) => node.id === "future-browser-node");
    expect(unknown?.componentId).toBe("future-component");
    expect(unknown?.props?.preserved).toBe(true);
    const mutations = await page.request.get(`${adminBase}/api/admin/cms/pages/${saved.data!.id}/mutations`);
    expect(mutations.ok()).toBeTruthy();
    const mutationBody = await mutations.json() as { data?: unknown[] };
    expect(mutationBody.data?.length ?? 0).toBeGreaterThan(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[aria-label="Visual page builder"]')).toBeVisible({ timeout: 30_000 });
  });

  test("CMS-09..CMS-12 global editing, Component Canvas, variants, and code model", async ({ page }) => {
    const frame = page.locator('iframe[title="Storefront canvas"]').contentFrame();
    await expect(frame.locator('[data-cms-id="storefront-header"]')).toBeVisible({ timeout: 30_000 });
    await frame.locator('[data-cms-id="storefront-header"]').click({ force: true });
    await expect(page.getByText(/Live DOM element|Storefront navbar/).first()).toBeVisible();

    await page.getByRole("button", { name: "Components", exact: true }).click();
    await page.getByRole("button", { name: /Hero banner/ }).first().click();
    const componentCanvas = page.locator('iframe[title="Isolated component definition canvas"]');
    await expect(componentCanvas).toBeVisible();
    const componentFrame = componentCanvas.contentFrame();
    await expect(componentFrame.locator('[data-cms-prop="title"]')).toBeVisible();
    await componentFrame.locator('[data-cms-prop="title"]').fill("Browser-authored hero");
    await expect(page.getByLabel("Main component definition JSON")).toHaveValue(/Browser-authored hero/);
    await expect(page.getByLabel("Main component definition JSON")).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Component variants" })).toBeVisible();
    await expect(page.getByText("Component definition", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Navigator", exact: true }).click();
    for (const tool of [
      "Pages",
      "Site map",
      "Navigation",
      "Announcement",
      "Categories",
      "Media",
      "Blog",
      "Forms",
      "Redirects",
      "Experiments",
      "Product lookup",
    ]) {
      await page.getByRole("button", { name: tool, exact: true }).last().click();
      await expect(page.getByRole("button", { name: "Back to canvas", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Back to canvas", exact: true }).click();
      await page.getByRole("button", { name: "Navigator", exact: true }).click();
    }
  });
});
