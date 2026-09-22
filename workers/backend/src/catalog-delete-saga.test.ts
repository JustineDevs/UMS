import assert from "node:assert/strict";
import test from "node:test";
import { deleteCatalogProductWithProviderArchive } from "./catalog-delete-saga.ts";

function request(key = "delete-key"): Request {
  return new Request("https://worker.test/api/admin/catalog/products/product_1", {
    method: "DELETE",
    headers: { Authorization: "Bearer staff-token", "Idempotency-Key": key },
  });
}

async function expectedArchiveKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const suffix = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `catalog-provider-archive:${suffix}`;
}

test("archives provider artifacts before deleting and returns the archive result", async () => {
  const calls: string[] = [];
  const deleteRequest = request();
  const response = await deleteCatalogProductWithProviderArchive(deleteRequest, "product_1", {
    archiveProvider: async (archiveRequest) => {
      calls.push("archive");
      assert.equal(archiveRequest.method, "DELETE");
      assert.equal(archiveRequest.headers.get("Authorization"), "Bearer staff-token");
      assert.equal(archiveRequest.headers.get("Idempotency-Key"), await expectedArchiveKey("delete-key"));
      assert.deepEqual(await archiveRequest.json(), { productId: "product_1" });
      return Response.json({ data: { archived: true, productId: "product_1" } });
    },
    deleteProduct: async (_deleteRequest, productId) => {
      calls.push("delete");
      assert.equal(_deleteRequest, deleteRequest);
      assert.equal(productId, "product_1");
      return Response.json({ deleted: true, productId });
    },
  });
  assert.deepEqual(calls, ["archive", "delete"]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    deleted: true,
    productId: "product_1",
    stripeCatalogArchive: { state: "archived" },
  });
});

test("derives a bounded archive key from a maximum-length delete key", async () => {
  const longKey = "k".repeat(255);
  let archiveKey = "";
  const response = await deleteCatalogProductWithProviderArchive(request(longKey), "product_1", {
    archiveProvider: async (archiveRequest) => {
      archiveKey = archiveRequest.headers.get("Idempotency-Key") ?? "";
      return Response.json({ data: { archived: true } });
    },
    deleteProduct: async (_deleteRequest, productId) => Response.json({ deleted: true, productId }),
  });
  assert.equal(response.status, 200);
  assert.ok(archiveKey.length <= 255);
  assert.equal(archiveKey, await expectedArchiveKey(longKey));
});

test("does not delete a product when provider archival fails", async () => {
  let deleteCalled = false;
  const response = await deleteCatalogProductWithProviderArchive(request(), "product_1", {
    archiveProvider: async () => Response.json({ code: "PROVIDER_RECONCILIATION_REQUIRED" }, { status: 502 }),
    deleteProduct: async () => { deleteCalled = true; return Response.json({ deleted: true }); },
  });
  assert.equal(response.status, 502);
  assert.equal(deleteCalled, false);
  assert.deepEqual(await response.json(), {
    error: "provider_archive_failed_product_not_deleted",
    code: "CATALOG_PROVIDER_ARCHIVE_FAILED",
    providerCode: "PROVIDER_RECONCILIATION_REQUIRED",
  });
});

test("retains provider archival and returns deletion failure for safe idempotent retry", async () => {
  const response = await deleteCatalogProductWithProviderArchive(request("retry-key"), "product_1", {
    archiveProvider: async () => Response.json({ data: { archived: true } }),
    deleteProduct: async () => Response.json({ error: "catalog_product_finalization_unavailable" }, { status: 503 }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "catalog_product_finalization_unavailable" });
});

test("rejects missing idempotency before calling either operation", async () => {
  let called = false;
  const response = await deleteCatalogProductWithProviderArchive(request(" "), "product_1", {
    archiveProvider: async () => { called = true; return Response.json({}); },
    deleteProduct: async () => { called = true; return Response.json({}); },
  });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});
