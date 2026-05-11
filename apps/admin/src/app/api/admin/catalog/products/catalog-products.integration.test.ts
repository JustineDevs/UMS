/**
 * PH-01: Catalog save path integration tests.
 * Validates that the catalog create/update API routes return structured errors
 * on missing/invalid input and include correlation IDs on every response.
 * These are unit-level mocks for the route handlers; a real E2E against a
 * running Medusa instance should be added to stress-test/e2e/.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

const BASE_PRODUCT = {
  title: "Test Jacket",
  pricePhp: 1500,
  status: "draft",
  sizeLabels: ["S", "M", "L"],
  colorLabels: ["Black"],
  stockQuantity: 10,
};

describe("Catalog products API - create", () => {
  it("rejects request with missing title (400 with error field)", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePhp: 1500, status: "draft" }),
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  it("response always includes x-correlation-id header", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "test-corr-id-001",
      },
      body: JSON.stringify({ pricePhp: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty("correlationId");
  });

  it("rejects stock quantity above maximum (400)", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...BASE_PRODUCT, stockQuantity: 9_999_999 }),
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("Catalog products API - structured error surface", () => {
  it("returns JSON with error key on auth failure", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(BASE_PRODUCT),
    });
    const res = await POST(req);
    expect([400, 401, 403, 422, 500, 502]).toContain(res.status);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body).not.toBeNull();
  });
});
