import assert from "node:assert/strict";
import test from "node:test";
import {
  finalizeNativeOrder,
  finalizeNativeOrderAcrossDatabases,
  handleNativeOrderFinalizationRequest,
} from "./order-finalization.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function client(
  handler: (_text: string, _values: readonly unknown[]) => unknown,
): WorkerDatabaseClient {
  const calls: string[] = [];
  return {
    async query(text, values = []) {
      calls.push(text);
      const result = await handler(text, values);
      return result as { rows: Record<string, unknown>[]; rowCount: number };
    },
    async end() {},
    calls,
  } as WorkerDatabaseClient & { calls: string[] };
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function finalizationAuthorization(
  correlationId: string,
  cartId = "cart_1",
): Promise<string> {
  const secret = "worker-test-secret";
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    sub: "test-finalizer",
    scope: "payment:finalize",
    correlation_id: correlationId,
    cart_id: cartId,
    iss: "uvs.internal",
    aud: "uvs-worker",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)),
  ).toString("base64url");
  return `Bearer ${input}.${signature}`;
}

test("finalizes a paid cart using one transaction and links the attempt", async () => {
  const queries: string[] = [];
  let orderInsertValues: readonly unknown[] | undefined;
  const database = client((text, values) => {
    queries.push(text);
    if (text.includes("INSERT INTO public.order\n")) orderInsertValues = values;
    if (text.includes("FROM public.payment_attempts"))
      return {
        rows: [
          {
            correlation_id: "00000000-0000-4000-8000-000000000001",
            cart_id: "cart_1",
            provider: "stripe",
            amount_minor: 5997,
            currency: "php",
            provider_payment_id: "pi_test",
            provider_payload: {},
            status: "paid",
            medusa_order_id: null,
          },
        ],
        rowCount: 1,
      };
    if (text.includes("metadata->>'worker_payment_correlation_id'"))
      return { rows: [], rowCount: 0 };
    if (text.includes("FROM public.cart\n"))
      return {
        rows: [
          {
            id: "cart_1",
            region_id: "reg_1",
            customer_id: null,
            sales_channel_id: "sc_1",
            email: "buyer@example.com",
            currency_code: "php",
            shipping_address_id: null,
            billing_address_id: null,
            metadata: {},
          },
        ],
        rowCount: 1,
      };
    if (text.includes("FROM public.cart_line_item"))
      return {
        rows: [
          {
            id: "line_1",
            title: "Guitar",
            subtitle: null,
            thumbnail: null,
            quantity: 1,
            variant_id: "var_1",
            product_id: "prod_1",
            product_title: "Guitar",
            product_description: null,
            product_subtitle: null,
            product_type: null,
            product_collection: null,
            product_handle: "guitar",
            variant_sku: null,
            variant_barcode: null,
            variant_title: null,
            variant_option_values: {},
            requires_shipping: true,
            is_discountable: true,
            is_tax_inclusive: false,
            compare_at_unit_price: null,
            raw_compare_at_unit_price: null,
            unit_price: "5997",
            raw_unit_price: { value: "5997" },
            metadata: {},
            product_type_id: null,
            is_custom_price: false,
            is_giftcard: false,
          },
        ],
        rowCount: 1,
      };
    return { rows: [{ id: "ok" }], rowCount: 1 };
  });
  const result = await finalizeNativeOrder(
    database,
    "00000000-0000-4000-8000-000000000001",
    "org_1",
  );
  assert.equal(result.replayed, false);
  assert.match(result.orderId, /^order_/);
  assert.equal(queries[0], "BEGIN");
  assert.equal(queries.at(-1), "COMMIT");
  assert.ok(
    queries.some((query) =>
      query.includes("INSERT INTO public.order_line_item"),
    ),
  );
  assert.ok(
    orderInsertValues &&
      typeof orderInsertValues[6] === "string" &&
      JSON.parse(orderInsertValues[6]).organization_id === "org_1",
  );
  assert.ok(
    queries.some((query) => query.includes("UPDATE public.payment_attempts")),
  );
});

test("rolls back when the payment is not settled", async () => {
  const database = client((text) => {
    if (text.includes("FROM public.payment_attempts"))
      return {
        rows: [
          {
            correlation_id: "00000000-0000-4000-8000-000000000002",
            cart_id: "cart_1",
            status: "pending",
            medusa_order_id: null,
          },
        ],
        rowCount: 1,
      };
    return { rows: [], rowCount: 0 };
  });
  await assert.rejects(
    () => finalizeNativeOrder(database, "00000000-0000-4000-8000-000000000002"),
    /payment_not_settled/,
  );
});

test("split topology routes payment attempts to APP and commerce writes to Medusa", async () => {
  const appQueries: string[] = [];
  const commerceQueries: string[] = [];
  const app = client((text) => {
    appQueries.push(text);
    if (
      text.includes("UPDATE public.payment_attempts") &&
      text.includes("RETURNING")
    )
      return {
        rows: [
          {
            correlation_id: "00000000-0000-4000-8000-000000000003",
            cart_id: "cart_1",
            provider: "stripe",
            amount_minor: 5997,
            currency: "php",
            provider_payment_id: "pi_test",
            provider_payload: {},
            status: "paid",
            medusa_order_id: null,
          },
        ],
        rowCount: 1,
      };
    if (text.includes("FROM public.payment_attempts"))
      return {
        rows: [
          {
            correlation_id: "00000000-0000-4000-8000-000000000003",
            cart_id: "cart_1",
            provider: "stripe",
            amount_minor: 5997,
            currency: "php",
            provider_payment_id: "pi_test",
            provider_payload: {},
            status: "paid",
            medusa_order_id: null,
          },
        ],
        rowCount: 1,
      };
    return { rows: [], rowCount: 1 };
  });
  const commerce = client((text) => {
    commerceQueries.push(text);
    if (text.includes("metadata->>'worker_payment_correlation_id'"))
      return { rows: [], rowCount: 0 };
    if (text.includes("FROM public.cart\n"))
      return {
        rows: [
          {
            id: "cart_1",
            region_id: "reg_1",
            customer_id: null,
            sales_channel_id: "sc_1",
            email: "buyer@example.com",
            currency_code: "php",
            shipping_address_id: null,
            billing_address_id: null,
            metadata: {},
          },
        ],
        rowCount: 1,
      };
    if (text.includes("FROM public.cart_line_item"))
      return {
        rows: [
          {
            id: "line_1",
            title: "Guitar",
            subtitle: null,
            thumbnail: null,
            quantity: 1,
            variant_id: "var_1",
            product_id: "prod_1",
            product_title: "Guitar",
            product_description: null,
            product_subtitle: null,
            product_type: null,
            product_collection: null,
            product_handle: "guitar",
            variant_sku: null,
            variant_barcode: null,
            variant_title: null,
            variant_option_values: {},
            requires_shipping: true,
            is_discountable: true,
            is_tax_inclusive: false,
            compare_at_unit_price: null,
            raw_compare_at_unit_price: null,
            unit_price: "5997",
            raw_unit_price: { value: "5997" },
            metadata: {},
            product_type_id: null,
            is_custom_price: false,
            is_giftcard: false,
          },
        ],
        rowCount: 1,
      };
    return { rows: [{ id: "ok" }], rowCount: 1 };
  });
  const result = await finalizeNativeOrderAcrossDatabases(
    app,
    commerce,
    "00000000-0000-4000-8000-000000000003",
    "org_1",
  );
  assert.equal(result.replayed, false);
  assert.ok(
    appQueries.some((query) => query.includes("FROM public.payment_attempts")),
  );
  assert.ok(
    appQueries.some((query) =>
      query.includes("UPDATE public.payment_attempts"),
    ),
  );
  assert.ok(
    appQueries.some((query) =>
      query.includes("UPDATE public.commerce_attribution"),
    ),
  );
  assert.ok(
    commerceQueries.some((query) => query.includes("INSERT INTO public.order")),
  );
  assert.ok(commerceQueries.includes("BEGIN"));
  const claim = appQueries.find((query) =>
    query.includes("SET checkout_state = 'finalizing'"),
  );
  assert.match(claim ?? "", /updated_at < now\(\) - interval '10 minutes'/);
});

test("reconciles a committed commerce order before retrying the cart", async () => {
  const appQueries: string[] = [];
  const commerceQueries: string[] = [];
  const app = client((text) => {
    appQueries.push(text);
    if (text.includes("SET checkout_state = 'finalizing'")) {
      return {
        rows: [
          {
            correlation_id: "00000000-0000-4000-8000-000000000004",
            cart_id: "cart_1",
            provider: "stripe",
            amount_minor: 5997,
            currency: "php",
            status: "paid",
            medusa_order_id: null,
          },
        ],
        rowCount: 1,
      };
    }
    if (text.includes("FROM public.payment_attempts")) {
      return {
        rows: [
          {
            correlation_id: "00000000-0000-4000-8000-000000000004",
            cart_id: "cart_1",
            provider: "stripe",
            amount_minor: 5997,
            currency: "php",
            status: "paid",
            medusa_order_id: null,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  const commerce = client((text) => {
    commerceQueries.push(text);
    if (text.includes("metadata->>'worker_payment_correlation_id'")) {
      return { rows: [{ id: "order_existing" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const result = await finalizeNativeOrderAcrossDatabases(
    app,
    commerce,
    "00000000-0000-4000-8000-000000000004",
    "org_1",
  );
  assert.deepEqual(result, { orderId: "order_existing", replayed: true });
  assert.ok(
    commerceQueries.some((query) =>
      query.includes("worker_payment_correlation_id"),
    ),
  );
  assert.ok(
    commerceQueries.some((query) =>
      query.includes("jsonb_build_object") &&
      query.includes("organization_id"),
    ),
  );
  assert.ok(
    appQueries.some((query) => query.includes("SET medusa_order_id = $2")),
  );
});

test("returns a retryable conflict while another finalization lease is active", async () => {
  const app = client((text) => {
    if (text.includes("SELECT cart_id"))
      return { rows: [{ cart_id: "cart_1" }], rowCount: 1 };
    if (text.includes("SET checkout_state = 'finalizing'"))
      return { rows: [], rowCount: 0 };
    return { rows: [{ medusa_order_id: null }], rowCount: 1 };
  });
  const commerce = client(() => ({ rows: [], rowCount: 0 }));
  const response = await handleNativeOrderFinalizationRequest(
    new Request(
      "https://api.test/store/checkout-intents/00000000-0000-4000-8000-000000000005/finalize",
      {
        method: "POST",
        headers: {
          Authorization: await finalizationAuthorization(
            "00000000-0000-4000-8000-000000000005",
          ),
        },
      },
    ),
    commerce,
    "00000000-0000-4000-8000-000000000005",
    app,
    undefined,
    { JWT_SECRET: "worker-test-secret" },
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "payment_finalization_in_progress",
    code: "FINALIZE_IN_PROGRESS",
  });
});

test("rejects a signed internal token whose cart does not own the attempt", async () => {
  const app = client((text) =>
    text.includes("SELECT cart_id")
      ? { rows: [{ cart_id: "cart_owner" }], rowCount: 1 }
      : { rows: [], rowCount: 0 },
  );
  const commerce = client(() => {
    throw new Error("order database must not be queried");
  });
  const correlationId = "00000000-0000-4000-8000-000000000008";
  const authorization = await finalizationAuthorization(
    correlationId,
    "cart_attacker",
  );
  const response = await handleNativeOrderFinalizationRequest(
    new Request(`https://api.test/store/checkout-intents/${correlationId}/finalize`, {
      method: "POST", headers: { Authorization: authorization },
    }),
    commerce,
    correlationId,
    app,
    undefined,
    { JWT_SECRET: "worker-test-secret" },
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "payment_attempt_not_found" });
});

test("rejects public finalization without a matching cart capability or internal token", async () => {
  const app = client(() => {
    throw new Error("database must not be queried");
  });
  const commerce = client(() => {
    throw new Error("database must not be queried");
  });
  const response = await handleNativeOrderFinalizationRequest(
    new Request(
      "https://api.test/store/checkout-intents/00000000-0000-4000-8000-000000000006/finalize",
      { method: "POST" },
    ),
    commerce,
    "00000000-0000-4000-8000-000000000006",
    app,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("rejects a cart cookie that does not own the payment attempt", async () => {
  const app = client((text) =>
    text.includes("SELECT cart_id")
      ? { rows: [{ cart_id: "cart_owner" }], rowCount: 1 }
      : { rows: [], rowCount: 0 },
  );
  const commerce = client(() => {
    throw new Error("order database must not be queried");
  });
  const response = await handleNativeOrderFinalizationRequest(
    new Request(
      "https://api.test/store/checkout-intents/00000000-0000-4000-8000-000000000007/finalize",
      { method: "POST", headers: { Cookie: "mcart_id=cart_attacker" } },
    ),
    commerce,
    "00000000-0000-4000-8000-000000000007",
    app,
  );
  assert.equal(response.status, 404);
});

test("allows the owning cart cookie to reach the durable finalization claim", async () => {
  const app = client((text) => {
    if (text.includes("SELECT cart_id"))
      return { rows: [{ cart_id: "cart_owner" }], rowCount: 1 };
    if (text.includes("SET checkout_state = 'finalizing'"))
      return { rows: [], rowCount: 0 };
    return { rows: [{ medusa_order_id: null }], rowCount: 1 };
  });
  const commerce = client(() => ({ rows: [], rowCount: 0 }));
  const response = await handleNativeOrderFinalizationRequest(
    new Request(
      "https://api.test/store/checkout-intents/00000000-0000-4000-8000-000000000008/finalize",
      { method: "POST", headers: { Cookie: "mcart_id=cart_owner" } },
    ),
    commerce,
    "00000000-0000-4000-8000-000000000008",
    app,
  );
  assert.equal(response.status, 409);
  assert.ok(
    (app as WorkerDatabaseClient & { calls: string[] }).calls.some((query) =>
      query.includes("SET checkout_state = 'finalizing'"),
    ),
  );
});

test("allows the matching checkout-attempt capability when the cart cookie is unavailable", async () => {
  const app = client((text) => {
    if (text.includes("SELECT cart_id"))
      return { rows: [{ cart_id: "cart_owner" }], rowCount: 1 };
    if (text.includes("SET checkout_state = 'finalizing'"))
      return { rows: [], rowCount: 0 };
    return { rows: [{ medusa_order_id: null }], rowCount: 1 };
  });
  const commerce = client(() => ({ rows: [], rowCount: 0 }));
  const correlationId = "00000000-0000-4000-8000-000000000009";
  const response = await handleNativeOrderFinalizationRequest(
    new Request(`https://api.test/store/checkout-intents/${correlationId}/finalize`, {
      method: "POST",
      headers: { Cookie: `checkout_attempt_id=${correlationId}` },
    }),
    commerce,
    correlationId,
    app,
  );
  assert.equal(response.status, 409);
  assert.ok(
    (app as WorkerDatabaseClient & { calls: string[] }).calls.some((query) =>
      query.includes("SET checkout_state = 'finalizing'"),
    ),
  );
});
