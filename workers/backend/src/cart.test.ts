import assert from "node:assert/strict";
import test from "node:test";
import {
  handleCreateCartRequest,
  handleCartUpdateRequest,
  addCartLine,
  getCartById,
  handleAddCartLineRequest,
  handleCartLineQuantityRequest,
  handleCartRequest,
  updateCartLineQuantity,
} from "./cart.ts";

test("creates an empty cart with a server-generated identifier and idempotency", async () => {
  const queries: string[] = [];
  const response = await handleCreateCartRequest(
    new Request("https://api.test/store/carts", {
      method: "POST",
      headers: { "Idempotency-Key": "cart-create-1", "Content-Type": "application/json" },
      body: JSON.stringify({ currency_code: "PHP", region_id: "reg-ph", sales_channel_id: "sc-web" }),
    }),
    {
      async query<Row>(text: string): Promise<{ rows: Row[]; rowCount: number }> {
        queries.push(text);
        if (text.includes("worker_idempotency_records"))
          return { rows: [{ state: "pending", request_hash: "" }] as Row[], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
      async end(): Promise<void> {},
    },
  );
  assert.equal(response.status, 201);
  const payload = (await response.json()) as { cart: { id: string; currency_code: string; sales_channel_id: string; items: unknown[] } };
  assert.match(payload.cart.id, /^cart_/);
  assert.equal(payload.cart.currency_code, "php");
  assert.equal(payload.cart.sales_channel_id, "sc-web");
  assert.deepEqual(payload.cart.items, []);
  assert.equal(queries.filter((query) => query.includes("INSERT INTO public.cart")).length, 1);
});

test("reads an active cart and its non-deleted line items from the database", async () => {
  let parameters: readonly unknown[] = [];
  const cart = await getCartById("cart-1", {
    async query<Row>(
      _text: string,
      values: readonly unknown[] = [],
    ): Promise<{ rows: Row[]; rowCount: number }> {
      parameters = values;
      return {
        rowCount: 2,
        rows: [
          {
            cart_id: "cart-1",
            region_id: "reg-1",
            currency_code: "php",
            email: "buyer@example.com",
            item_id: "item-1",
            title: "Canary",
            quantity: 1,
            variant_id: "var-1",
            product_id: "prod-1",
            unit_price: 5997,
            thumbnail: "/canary.jpg",
            variant_title: "Default",
            product_handle: "canary",
            variant_sku: "GTR-1",
          },
          {
            cart_id: "cart-1",
            region_id: "reg-1",
            currency_code: "php",
            email: "buyer@example.com",
            item_id: "item-2",
            title: "Cable",
            quantity: 2,
            variant_id: "var-2",
            product_id: "prod-2",
            unit_price: 900,
            thumbnail: null,
            variant_title: "Black",
            product_handle: "cable",
            variant_sku: "CAB-1",
          },
        ] as Row[],
      };
    },
    async end(): Promise<void> {},
  });
  assert.equal(cart?.id, "cart-1");
  assert.equal((cart?.items as Array<{ quantity: number }>)[1]?.quantity, 2);
  assert.deepEqual(parameters, ["cart-1"]);
});

test("does not return completed or missing carts", async () => {
  const response = await handleCartRequest(
    new Request("https://api.test/store/carts/cart-1"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return { rows: [], rowCount: 0 };
      },
      async end(): Promise<void> {},
    },
    "cart-1",
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    type: "not_found",
    message: "Cart not found",
  });
});

test("updates cart checkout identity and addresses transactionally", async () => {
  const statements: string[] = [];
  const response = await handleCartUpdateRequest(
    new Request("https://api.test/store/carts/cart-1", {
      method: "PATCH",
      headers: { "Idempotency-Key": "cart-update-1", "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buyer@example.com",
        shipping_address: { first_name: "Buyer", country_code: "PH", city: "Manila" },
        metadata: { payment_provider: "cod" },
      }),
    }),
    {
      async query<Row>(text: string): Promise<{ rows: Row[]; rowCount: number }> {
        statements.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
          return { rows: [{ state: "claimed", request_hash: "" }] as Row[], rowCount: 1 };
        if (text.startsWith("SELECT id FROM public.cart"))
          return { rows: [{ id: "cart-1" }] as Row[], rowCount: 1 };
        if (text.startsWith("SELECT c.id AS cart_id"))
          return { rows: [{ cart_id: "cart-1", region_id: null, sales_channel_id: "sc-web", currency_code: "php", email: "buyer@example.com", item_id: null }] as Row[], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
      async end(): Promise<void> {},
    },
    "cart-1",
  );
  assert.equal(response.status, 200, await response.clone().text());
  assert.ok(statements[0]?.startsWith("INSERT INTO public.worker_idempotency_records"));
  assert.ok(statements.some((statement) => statement.includes("INSERT INTO public.cart_address")));
  assert.ok(statements.some((statement) => statement.includes("UPDATE public.cart SET")));
  assert.ok(statements.includes("COMMIT"));
});

test("updates a line inside a transaction and removes it at quantity zero", async () => {
  const statements: string[] = [];
  const client = {
    async query<T>(text: string): Promise<{ rows: T[]; rowCount: number }> {
      statements.push(text);
      return {
        rows: text.startsWith("SELECT") ? [{ id: "line-1" } as T] : [],
        rowCount: 1,
      };
    },
    async end(): Promise<void> {},
  };
  assert.deepEqual(
    await updateCartLineQuantity("cart-1", "line-1", 3, client),
    { updated: true, removed: false },
  );
  assert.deepEqual(
    await updateCartLineQuantity("cart-1", "line-1", 0, client),
    { updated: false, removed: true },
  );
  assert.equal(statements[0], "BEGIN");
  assert.match(statements[1] ?? "", /FOR UPDATE/);
  assert.match(statements[1] ?? "", /available_quantity/);
  assert.equal(
    statements[2],
    "UPDATE public.cart_line_item SET quantity = $1, updated_at = now() WHERE id = $2",
  );
  assert.equal(statements[3], "COMMIT");
  assert.equal(statements[4], "BEGIN");
  assert.equal(
    statements[6],
    "UPDATE public.cart_line_item SET deleted_at = now(), updated_at = now() WHERE id = $1",
  );
  assert.equal(statements[7], "COMMIT");
});

test("requires idempotency for cart quantity mutations", async () => {
  const response = await handleCartLineQuantityRequest(
    new Request("https://api.test/store/carts/cart-1/line-items/line-1", {
      method: "PUT",
      body: '{"quantity":2}',
    }),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        throw new Error("must not query");
      },
      async end(): Promise<void> {},
    },
    "cart-1",
    "line-1",
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "idempotency_key_required",
  });
});

test("adds one line with server-selected price and rejects requested quantity beyond stock", async () => {
  const statements: string[] = [];
  const client = {
    async query<T>(text: string): Promise<{ rows: T[]; rowCount: number }> {
      statements.push(text);
      if (text.startsWith("SELECT"))
        return {
          rows: [
            {
              cart_id: "cart-1",
              currency_code: "php",
              product_id: "prod-1",
              product_title: "Canary",
              product_handle: "canary",
              product_description: null,
              thumbnail: null,
              variant_id: "var-1",
              variant_title: "Default",
              variant_sku: "GTR-1",
              allow_backorder: false,
              unit_price: "5997",
              available_quantity: "3",
            },
          ] as T[],
          rowCount: 1,
        };
      return { rows: [], rowCount: 1 };
    },
    async end(): Promise<void> {},
  };
  const added = await addCartLine("cart-1", "var-1", 1, client);
  assert.match(added.lineId, /^line_[0-9a-f-]+$/);
  assert.equal(added.quantity, 1);
  assert.equal(added.unitPrice, 5997);
  assert.match(statements[2] ?? "", /INSERT INTO public\.cart_line_item/);
});

test("defaults add-to-cart quantity to one", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const response = await handleAddCartLineRequest(
    new Request("https://api.test/store/carts/cart-1/line-items", {
      method: "POST",
      body: '{"variant_id":"var-1"}',
      headers: { "Idempotency-Key": "add-1" },
    }),
    {
      async query<Row>(
        text: string,
        values: readonly unknown[] = [],
      ): Promise<{ rows: Row[]; rowCount: number }> {
        queries.push({ text, values });
        if (text.includes("INSERT INTO public.worker_idempotency_records"))
          return { rows: [], rowCount: 1 };
        if (text.includes("FROM public.cart c"))
          return {
            rows: [
              {
                cart_id: "cart-1",
                currency_code: "php",
                product_id: "prod-1",
                product_title: "Canary",
                product_handle: "canary",
                product_description: null,
                thumbnail: null,
                variant_id: "var-1",
                variant_title: "Default",
                variant_sku: "GTR-1",
                allow_backorder: false,
                unit_price: 5997,
                available_quantity: 3,
              },
            ] as Row[],
            rowCount: 1,
          };
        if (text.includes("UPDATE public.worker_idempotency_records"))
          return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
      async end(): Promise<void> {},
    },
    "cart-1",
  );
  assert.equal(response.status, 200);
  assert.equal(
    ((await response.json()) as { line_item: { quantity: number } }).line_item
      .quantity,
    1,
  );
  assert.equal(
    queries.find((query) =>
      query.text.includes("INSERT INTO public.cart_line_item"),
    )?.values[5],
    1,
  );
});
