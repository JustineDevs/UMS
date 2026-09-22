import { test, expect } from "@playwright/test";
import { adminBase, e2eAdminLogin } from "../helpers/admin-e2e-auth";

test.describe.configure({ mode: "serial" });

const persistedCanvasNode =
  '[data-cms-id="home-hero-title"]:not([hidden])';

test.describe("@admin CMS canonical editor", () => {
  let homepageSnapshot: Record<string, unknown> | undefined;
  let createdPageId: string | undefined;

  test.beforeEach(async ({ page }) => {
    homepageSnapshot = undefined;
    createdPageId = undefined;
    const login = await e2eAdminLogin(page);
    if (login === "skip_no_ui" || login === "skip_no_env") {
      test.skip(true, "Admin E2E auth is not configured.");
    }
    await page.goto(`${adminBase}/admin/cms/builder`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator('[aria-label="Visual page builder"]'),
    ).toBeVisible({ timeout: 30_000 });

    if (test.info().title.startsWith("CMS-05..")) {
      const response = await page.request.get(
        `${adminBase}/api/admin/storefront-home`,
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const body = (await response.json()) as {
        data?: Record<string, unknown>;
      };
      expect(body.data).toBeDefined();
      homepageSnapshot = body.data;
    }
  });

  test.afterEach(async ({ page }) => {
    const cleanupErrors: string[] = [];

    if (homepageSnapshot) {
      try {
        const response = await page.request.put(
          `${adminBase}/api/admin/storefront-home`,
          {
            headers: {
              "Idempotency-Key": `cms-e2e-home-restore-${Date.now()}`,
            },
            data: homepageSnapshot,
          },
        );
        if (!response.ok()) {
          cleanupErrors.push(`Homepage restore failed: ${await response.text()}`);
        }
      } catch (error) {
        cleanupErrors.push(`Homepage restore failed: ${String(error)}`);
      }
      homepageSnapshot = undefined;
    }

    if (createdPageId) {
      const pageId = createdPageId;
      try {
        const response = await page.request.delete(
          `${adminBase}/api/admin/cms/pages/${encodeURIComponent(pageId)}`,
          {
            headers: {
              "Idempotency-Key": `cms-e2e-page-cleanup-${pageId}`,
            },
          },
        );
        if (!response.ok()) {
          cleanupErrors.push(`CMS page cleanup failed: ${await response.text()}`);
        } else {
          const reloaded = await page.request.get(
            `${adminBase}/api/admin/cms/pages/${encodeURIComponent(pageId)}`,
          );
          if (reloaded.status() !== 404) {
            cleanupErrors.push(
              `CMS page ${pageId} still exists after cleanup (${reloaded.status()})`,
            );
          }
        }
      } catch (error) {
        cleanupErrors.push(`CMS page cleanup failed: ${String(error)}`);
      }
      createdPageId = undefined;
    }

    expect(cleanupErrors, cleanupErrors.join("\n")).toEqual([]);
  });

  test("CMS-01..CMS-04 unified workspace, persisted preview source, and selection", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Ai Assistant", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Context", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('iframe[title="Storefront canvas"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pages", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Components", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Toggle navigator", exact: true }),
    ).toBeVisible();

    const frame = page
      .locator('iframe[title="Storefront canvas"]')
      .contentFrame();
    const visibleNode = frame.locator(persistedCanvasNode).first();
    await expect(visibleNode).toBeVisible({ timeout: 30_000 });
    await visibleNode.click({ force: true });
    await expect(visibleNode).toHaveAttribute("data-uvs-id", /.+/);
    const selectedNode = frame.locator(
      '[data-cms-id][data-selected="true"]',
    );
    await expect(selectedNode.first()).toBeVisible();
    await expect(page.getByText("Live DOM element", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Content", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Breakpoints", exact: true }).click();
    await page.getByRole("button", { name: "Mobile view", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
  });

  test("CMS-07..CMS-09 inspector coverage and selection geometry remain stable", async ({
    page,
  }) => {
    const frame = page
      .locator('iframe[title="Storefront canvas"]')
      .contentFrame();
    const selected = frame.locator(persistedCanvasNode).first();
    await expect(selected).toBeVisible({ timeout: 30_000 });
    await selected.evaluate((node) => (node as HTMLElement).click());

    for (const tab of ["Content", "Style", "Advanced"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(
        page.getByRole("tab", { name: tab, exact: true }),
      ).toHaveClass(/bg-slate-100/);
    }
    await frame
      .locator("body")
      .evaluate((body) => body.scrollTo(0, body.scrollHeight));
    await page
      .locator('iframe[title="Storefront canvas"]')
      .evaluate((element) => {
        element.dispatchEvent(new Event("resize"));
        element.contentWindow?.postMessage(
          {
            source: "cms-builder",
            id: "invalid",
            rect: { x: 0, y: 0, width: -1, height: 0 },
          },
          window.location.origin,
        );
      });
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.locator("body")).not.toContainText(
      /Maximum update depth|Application error|Unhandled Runtime Error/i,
    );
  });

  test("CMS-05..CMS-08 slots, drag/drop, inspector, and command history", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Components", exact: true }).click();
    const add = page
      .getByRole("button", { name: /Add Call to action/ })
      .first();
    await expect(add).toBeVisible();
    await add.click();
    await page.getByRole("button", { name: "Pages", exact: true }).last().click();
    await page
      .getByRole("button", { name: "Hero banner", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Components", exact: true }).click();
    const dragSource = page.getByTestId("cms-component-drag-cta-row");
    const slotTarget = page
      .locator('[data-testid^="cms-slot-"][data-testid$="-actions"]')
      .first();
    await expect(slotTarget).toBeVisible();
    const slotItems = slotTarget.getByRole("button", {
      name: "Call to action",
      exact: true,
    });
    const initialSlotCount = await slotItems.count();
    await dragSource.dragTo(slotTarget);
    const invalidDrag = page
      .getByTestId(/cms-component-drag-/)
      .filter({ hasText: /Hero banner/i })
      .first();
    await invalidDrag.dragTo(slotTarget);
    await expect(page.getByText(/does not allow/i)).toBeVisible();
    await add.click();
    await page.getByRole("button", { name: "Pages", exact: true }).last().click();
    await page
      .getByRole("button", { name: "Hero banner", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Components", exact: true }).click();
    await dragSource.dragTo(slotTarget);
    await expect(slotItems).toHaveCount(initialSlotCount + 2);
    await slotTarget
      .getByRole("button", { name: "Move Call to action down" })
      .first()
      .click();
    await slotTarget
      .getByRole("button", { name: "Move Call to action up" })
      .last()
      .click();
    await slotTarget
      .getByRole("button", { name: "Remove Call to action" })
      .last()
      .click();
    await expect(slotItems).toHaveCount(initialSlotCount + 1);
    await page.getByRole("button", { name: "Toggle navigator", exact: true }).click();
    await expect(
      page.getByText("Call to action", { exact: true }).first(),
    ).toBeVisible();

    const frame = page
      .locator('iframe[title="Storefront canvas"]')
      .contentFrame();
    const selected = frame.locator(persistedCanvasNode).first();
    await selected.click({ force: true });
    const padding = page
      .locator("label")
      .filter({ hasText: "padding" })
      .last()
      .locator("input");
    await expect(padding).toBeVisible();
    await padding.fill("24px");
    await padding.blur();
    const color = page
      .locator("label")
      .filter({ hasText: /^color$/ })
      .last()
      .locator("input");
    await expect(color).toBeVisible();
    await color.fill("rgb(190, 24, 93)");
    await color.blur();
    const activeSelected = frame
      .locator('[data-cms-id][data-selected="true"]')
      .first();
    await expect
      .poll(() =>
        activeSelected.evaluate((node) => getComputedStyle(node).color),
      )
      .toBe("rgb(190, 24, 93)");
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
    await expect(
      page.locator('[aria-label="Visual page builder"]'),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("CMS-13 canonical page tree publish and mutation reload", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Toggle navigator", exact: true }).click();
    await page
      .getByRole("button", { name: "Pages", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "Add page", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add page", exact: true }).click();

    const nestedBuilder = page
      .locator('[aria-label="Visual page builder"]')
      .last();
    await expect(nestedBuilder).toBeVisible({ timeout: 30_000 });
    await nestedBuilder
      .getByRole("button", { name: "Components", exact: true })
      .click();
    await nestedBuilder
      .getByRole("button", { name: /Add Call to action/ })
      .click();
    const save = nestedBuilder.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await expect(save).toBeVisible();
    const responsePromise = page.waitForResponse(
      (response) =>
        /\/api\/admin\/cms\/pages(?:\/[^/]+)?$/.test(response.url()) &&
        ["POST", "PUT"].includes(response.request().method()) &&
        response.status() === 200,
    );
    await save.click();
    const saved = (await (await responsePromise).json()) as {
      data?: {
        id?: string;
        slug?: string;
        status?: string;
        version?: number;
        tree?: unknown[];
        blocks?: unknown[];
      };
    };
    expect(saved.data?.id).toBeTruthy();
    createdPageId = saved.data!.id;
    expect(saved.data?.tree?.length ?? 0).toBeGreaterThan(0);
    const savedPage = await page.request.get(
      `${adminBase}/api/admin/cms/pages/${saved.data!.id}`,
    );
    expect(savedPage.ok(), await savedPage.text()).toBeTruthy();
    const persistedTree = [
      ...(saved.data!.tree ?? []),
      {
        id: "future-browser-node",
        componentId: "future-component",
        blockType: "future_block",
        parentId: null,
        slot: null,
        props: { preserved: true },
        styles: {},
        children: [],
      },
    ];
    const publish = await page.request.put(
      `${adminBase}/api/admin/cms/pages/${saved.data!.id}`,
      {
        headers: {
          "Idempotency-Key": `cms-publish-${saved.data!.id}-${Date.now()}`,
        },
        data: {
          id: saved.data!.id,
          slug: saved.data!.slug ?? "new-page",
          expectedVersion: saved.data!.version,
          status: "published",
          tree: persistedTree,
          blocks: saved.data!.blocks,
        },
      },
    );
    const publishText = await publish.text();
    const publishBody = publishText.startsWith("{")
      ? (JSON.parse(publishText) as {
          data?: { status?: string };
          error?: string;
        })
      : { error: publishText.slice(0, 160) };
    expect(publish.ok(), JSON.stringify(publishBody)).toBeTruthy();
    expect(publishBody.data?.status).toBe("published");
    const reloaded = await page.request.get(
      `${adminBase}/api/admin/cms/pages/${saved.data!.id}`,
    );
    const reloadedBody = (await reloaded.json()) as {
      data?: {
        tree?: Array<{
          id?: string;
          componentId?: string;
          props?: Record<string, unknown>;
        }>;
      };
    };
    const unknown = reloadedBody.data?.tree?.find(
      (node) => node.id === "future-browser-node",
    );
    expect(unknown?.componentId).toBe("future-component");
    expect(unknown?.props?.preserved).toBe(true);
    const mutations = await page.request.get(
      `${adminBase}/api/admin/cms/pages/${saved.data!.id}/mutations`,
    );
    expect(mutations.ok()).toBeTruthy();
    const mutationBody = (await mutations.json()) as { data?: unknown[] };
    expect(mutationBody.data?.length ?? 0).toBeGreaterThan(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.locator('[aria-label="Visual page builder"]'),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("CMS-09..CMS-12 global editing and embedded tools; Component Canvas remains disabled", async ({
    page,
  }) => {
    const frame = page
      .locator('iframe[title="Storefront canvas"]')
      .contentFrame();
    await expect(
      frame.locator('[data-cms-id="storefront-header"]'),
    ).toBeVisible({ timeout: 30_000 });
    await frame
      .locator('[data-cms-id="storefront-header"]')
      .evaluate((node) => (node as HTMLElement).click());
    await expect(
      page.getByText(/Live DOM element|Storefront navbar/).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Components", exact: true }).click();
    await page
      .getByRole("button", { name: /Hero banner/ })
      .first()
      .click();
    const componentCanvas = page.locator(
      'iframe[title="Isolated component definition canvas"]',
    );
    await expect(componentCanvas).toHaveCount(0);

    for (const tab of [
      "Pages",
      "Components",
      "Sections",
      "Style",
      "Ai Assistant",
    ]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(
        page.getByRole("button", { name: tab, exact: true }),
      ).toHaveAttribute("aria-label", tab);
    }
  });
});
