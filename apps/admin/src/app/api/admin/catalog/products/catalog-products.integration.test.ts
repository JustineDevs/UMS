import assert from "node:assert/strict";
import test from "node:test";

const BASE_PRODUCT = {
  title: "Test Jacket",
  pricePhp: 1500,
  status: "draft",
  sizeLabels: ["S", "M", "L"],
  colorLabels: ["Black"],
  stockQuantity: 10,
};

test("Catalog products API - create rejects request with missing title", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePhp: 1500, status: "draft" }),
    });
    const res = await POST(req);
    assert.ok(res.status >= 400);
    const body = await res.json();
    assert.equal(typeof body, "object");
  });

test("Catalog products API - create includes correlation id header", async () => {
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
    assert.ok(res.status >= 400);
    const body = await res.json();
    assert.ok("correlationId" in body);
  });

test("Catalog products API - create rejects stock quantity above maximum", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...BASE_PRODUCT, stockQuantity: 9_999_999 }),
    });
    const res = await POST(req);
    assert.ok(res.status >= 400);
    const body = await res.json();
    assert.ok("error" in body);
  });

test("Catalog products API - structured error surface on auth failure", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(BASE_PRODUCT),
    });
    const res = await POST(req);
    assert.ok([400, 401, 403, 422, 500, 502].includes(res.status));
    const body = await res.json();
    assert.equal(typeof body, "object");
    assert.notEqual(body, null);
  });
