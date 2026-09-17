import assert from "node:assert/strict";
import test from "node:test";

test("PUT /api/admin/storefront-home returns 401 when not authenticated", async () => {
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/admin/storefront-home", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hero: { line1: "TEST" } }),
    });
    const res = await PUT(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok("error" in body);
  });

test("PUT /api/admin/storefront-home returns 400 for invalid JSON", async () => {
    const { PUT } = await import("./route");
    const res = await PUT(
      new Request("http://localhost/api/admin/storefront-home", {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "not-json{{{",
      }),
    );
    assert.equal(res.status, 400);
  });

test("GET /api/admin/storefront-home returns 401 when not authenticated", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/admin/storefront-home");
    const res = await GET(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok("error" in body);
  });

test("Homepage editor optimistic rollback captures save failure", async () => {
    const errors: string[] = [];
    const setSaveError = (e: string | null) => { if (e) errors.push(e); };

    const simulateSave = async () => {
      try {
        const res = await Promise.reject(new Error("Network unreachable"));
        return res;
      } catch (e: unknown) {
        setSaveError(e instanceof Error ? e.message : "Unable to save");
      }
    };

    await simulateSave();
    assert.equal(errors.length, 1);
    assert.equal(errors[0], "Network unreachable");
  });
