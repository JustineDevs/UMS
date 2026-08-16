import assert from "node:assert/strict";
import test from "node:test";
import { dispatchBackInStockNotifications } from "./back-in-stock-delivery.js";

test("back-in-stock dispatch records provider success and marks the subscription notified", async () => {
  const events: string[] = [];
  const supabase = {
    from: () => ({
      upsert: async () => ({ error: null }),
      update: (values: unknown) => {
        events.push(`update:${JSON.stringify(values)}`);
        return { eq: async () => ({ error: null }) };
      },
    }),
  } as never;
  const result = await dispatchBackInStockNotifications(supabase, [{
    id: "notice_1",
    email: "fan@example.com",
    product_slug: "album-one",
    variant_id: "variant_1",
  }], {
    apiKey: "re_test",
    from: "store@example.com",
    siteOrigin: "https://store.example.com",
    nowIso: () => "2026-08-15T00:00:00.000Z",
    send: async (input) => {
      assert.equal(input.idempotencyKey, "back_in_stock:notice_1");
      return { ok: true, id: "email_1" };
    },
  });

  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.match(events[0] ?? "", /sent/);
});
