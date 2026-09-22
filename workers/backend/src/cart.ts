import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import {
  executeIdempotently,
  HyperdriveIdempotencyStore,
} from "./idempotency.ts";

type CartRow = {
  cart_id: string;
  region_id: string | null;
  sales_channel_id: string | null;
  currency_code: string;
  email: string | null;
  metadata?: Record<string, unknown> | null;
  item_id: string | null;
  title: string | null;
  quantity: number | null;
  variant_id: string | null;
  product_id: string | null;
  unit_price: string | number | null;
  thumbnail: string | null;
  variant_title: string | null;
  product_handle: string | null;
  variant_sku: string | null;
};

type AddLineRow = {
  cart_id: string;
  currency_code: string;
  product_id: string;
  product_title: string;
  product_handle: string;
  product_description: string | null;
  thumbnail: string | null;
  variant_id: string;
  variant_title: string;
  variant_sku: string | null;
  allow_backorder: boolean;
  unit_price: string | number | null;
  available_quantity: string | number;
};

export async function getCartById(
  cartId: string,
  database: WorkerDatabaseClient,
): Promise<Record<string, unknown> | null> {
  const normalized = cartId.trim();
  if (!normalized || normalized.length > 255) return null;
  const result = await database.query<CartRow>(
    `SELECT c.id AS cart_id, c.region_id, c.sales_channel_id, c.currency_code, c.email, c.metadata,
            i.id AS item_id, i.title, i.quantity, i.variant_id, i.product_id,
            i.unit_price, i.thumbnail, i.variant_title, i.product_handle, i.variant_sku
     FROM public.cart c
     LEFT JOIN public.cart_line_item i ON i.cart_id = c.id AND i.deleted_at IS NULL
     WHERE c.id = $1 AND c.deleted_at IS NULL AND c.completed_at IS NULL
     ORDER BY i.created_at, i.id`,
    [normalized],
  );
  const first = result.rows[0];
  if (!first) return null;
  const items = result.rows
    .filter((row) => row.item_id)
    .map((row) => ({
      id: row.item_id,
      title: row.title,
      quantity: row.quantity,
      variant_id: row.variant_id,
      product_id: row.product_id,
      unit_price: row.unit_price,
      thumbnail: row.thumbnail,
      variant_title: row.variant_title,
      product_handle: row.product_handle,
      variant_sku: row.variant_sku,
    }));
  return {
    id: first.cart_id,
    region_id: first.region_id,
    sales_channel_id: first.sales_channel_id,
    currency_code: first.currency_code,
    email: first.email,
    metadata: first.metadata ?? null,
    items,
  };
}

export async function handleCartRequest(
  request: Request,
  database: WorkerDatabaseClient,
  cartId: string,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const cart = await getCartById(cartId, database);
  if (!cart)
    return new Response(
      JSON.stringify({ type: "not_found", message: "Cart not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  return new Response(JSON.stringify({ cart }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

const SAFE_CART_ERRORS = new Set([
  "insufficient_stock",
  "cart_not_found",
  "cart_line_not_found",
  "variant_not_found",
]);

function safeCartError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return SAFE_CART_ERRORS.has(message) ? message : fallback;
}

export async function handleCreateCartRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "POST")
    return jsonResponse({ error: "method_not_allowed" }, 405);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return jsonResponse({ error: "idempotency_key_required" }, 400);
  const body = await request.text();
  let parsed: unknown = {};
  if (body.trim()) {
    try {
      parsed = JSON.parse(body);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return jsonResponse({ error: "invalid_cart" }, 400);
  const input = parsed as Record<string, unknown>;
  const currencyCode =
    typeof input.currency_code === "string"
      ? input.currency_code.trim().toLowerCase()
      : "php";
  const regionId = typeof input.region_id === "string" ? input.region_id.trim() : null;
  const salesChannelId =
    typeof input.sales_channel_id === "string"
      ? input.sales_channel_id.trim()
      : null;
  if (!/^[a-z]{3}$/.test(currencyCode))
    return jsonResponse({ error: "invalid_currency" }, 400);
  const requestBody = body.trim() || "{}";
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    key,
    await requestHash(request, requestBody),
    async () => {
      const cartId = `cart_${crypto.randomUUID()}`;
      await database.query(
        `INSERT INTO public.cart
           (id, region_id, sales_channel_id, currency_code, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())`,
        [cartId, regionId, salesChannelId, currencyCode],
      );
      return jsonResponse({
        cart: {
          id: cartId,
          region_id: regionId,
          sales_channel_id: salesChannelId,
          currency_code: currencyCode,
          items: [],
        },
      }, 201);
    },
  );
  return result.response;
}

type CartAddressInput = Record<string, unknown>;

const ADDRESS_FIELDS = [
  "company",
  "first_name",
  "last_name",
  "address_1",
  "address_2",
  "city",
  "country_code",
  "province",
  "postal_code",
  "phone",
] as const;

function parseCartAddress(value: unknown): Record<string, string | null> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as CartAddressInput;
  const output: Record<string, string | null> = {};
  for (const field of ADDRESS_FIELDS) {
    const raw = input[field];
    if (raw === undefined || raw === null) output[field] = null;
    else if (typeof raw === "string" && raw.trim().length <= 255)
      output[field] = raw.trim() || null;
    else return null;
  }
  if (output.country_code && !/^[a-z]{2}$/i.test(output.country_code)) return null;
  return output;
}

async function insertCartAddress(
  transaction: WorkerDatabaseClient,
  address: Record<string, string | null>,
): Promise<string> {
  const id = `cartaddr_${crypto.randomUUID()}`;
  await transaction.query(
    `INSERT INTO public.cart_address
       (id, company, first_name, last_name, address_1, address_2, city,
        country_code, province, postal_code, phone, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())`,
    [id, ...ADDRESS_FIELDS.map((field) => address[field])],
  );
  return id;
}

export async function handleCartUpdateRequest(
  request: Request,
  database: WorkerDatabaseClient,
  cartId: string,
): Promise<Response> {
  if (request.method !== "PUT" && request.method !== "PATCH")
    return jsonResponse({ error: "method_not_allowed" }, 405);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return jsonResponse({ error: "idempotency_key_required" }, 400);
  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return jsonResponse({ error: "invalid_cart" }, 400);
  const input = parsed as Record<string, unknown>;
  const hasEmail = Object.prototype.hasOwnProperty.call(input, "email");
  const email =
    input.email === null
      ? null
      : typeof input.email === "string" && input.email.trim().length <= 320
        ? input.email.trim().toLowerCase()
        : undefined;
  const metadata = input.metadata;
  const hasMetadata = Object.prototype.hasOwnProperty.call(input, "metadata");
  if (
    (hasEmail && email === undefined) ||
    (hasMetadata &&
      (!metadata || typeof metadata !== "object" || Array.isArray(metadata)))
  )
    return jsonResponse({ error: "invalid_cart" }, 400);
  const addressInputs = {
    shipping: Object.prototype.hasOwnProperty.call(input, "shipping_address")
      ? parseCartAddress(input.shipping_address)
      : undefined,
    billing: Object.prototype.hasOwnProperty.call(input, "billing_address")
      ? parseCartAddress(input.billing_address)
      : undefined,
  };
  if (
    (Object.prototype.hasOwnProperty.call(input, "shipping_address") && !addressInputs.shipping) ||
    (Object.prototype.hasOwnProperty.call(input, "billing_address") && !addressInputs.billing)
  )
    return jsonResponse({ error: "invalid_address" }, 400);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    key,
    await requestHash(request, body),
    async () => {
      try {
        const updated = await withWorkerTransaction(database, async (transaction) => {
          const existing = await transaction.query<{ id: string }>(
            `SELECT id FROM public.cart
             WHERE id = $1 AND deleted_at IS NULL AND completed_at IS NULL FOR UPDATE`,
            [cartId],
          );
          if (!existing.rows[0]) return false;
          const shippingId = addressInputs.shipping
            ? await insertCartAddress(transaction, addressInputs.shipping)
            : input.shipping_address === null
              ? null
              : undefined;
          const billingId = addressInputs.billing
            ? await insertCartAddress(transaction, addressInputs.billing)
            : input.billing_address === null
              ? null
              : undefined;
          await transaction.query(
            `UPDATE public.cart SET
               email = CASE WHEN $2::boolean THEN $3 ELSE email END,
               shipping_address_id = CASE WHEN $4::boolean THEN $5 ELSE shipping_address_id END,
               billing_address_id = CASE WHEN $6::boolean THEN $7 ELSE billing_address_id END,
               metadata = CASE WHEN $8::boolean THEN $9::jsonb ELSE metadata END,
               updated_at = now()
             WHERE id = $1`,
            [
              cartId,
              hasEmail,
              email,
              shippingId !== undefined,
              shippingId,
              billingId !== undefined,
              billingId,
              hasMetadata,
              hasMetadata ? JSON.stringify(metadata) : null,
            ],
          );
          return true;
        });
        if (!updated) return jsonResponse({ error: "cart_not_found" }, 404);
        const cart = await getCartById(cartId, database);
        return cart ? jsonResponse({ cart }) : jsonResponse({ error: "cart_not_found" }, 404);
      } catch (error) {
        return jsonResponse({ error: safeCartError(error, "cart_update_failed") }, 422);
      }
    },
  );
  return result.response;
}

async function requestHash(request: Request, body: string): Promise<string> {
  const bytes = new TextEncoder().encode(
    `${request.method}:${new URL(request.url).pathname}:${body}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function updateCartLineQuantity(
  cartId: string,
  lineId: string,
  quantity: number,
  database: WorkerDatabaseClient,
): Promise<{ updated: boolean; removed: boolean }> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10_000)
    throw new Error("invalid_cart_quantity");
  return withWorkerTransaction(database, async (transaction) => {
    const line = await transaction.query<{
      id: string;
      allow_backorder: boolean;
      available_quantity: string | number;
    }>(
      `SELECT i.id, COALESCE(v.allow_backorder, false) AS allow_backorder,
              COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
               FROM public.product_variant_inventory_item pvi
               JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
               WHERE pvi.variant_id = i.variant_id AND pvi.deleted_at IS NULL), 0) AS available_quantity
       FROM public.cart_line_item i
       JOIN public.cart c ON c.id = i.cart_id
       LEFT JOIN public.product_variant v ON v.id = i.variant_id AND v.deleted_at IS NULL
       WHERE i.id = $1 AND i.cart_id = $2 AND i.deleted_at IS NULL AND c.deleted_at IS NULL AND c.completed_at IS NULL
       FOR UPDATE`,
      [lineId, cartId],
    );
    if (line.rows.length === 0) return { updated: false, removed: false };
    if (
      quantity > 0 &&
      !line.rows[0].allow_backorder &&
      Number(line.rows[0].available_quantity) < quantity
    )
      throw new Error("insufficient_stock");
    if (quantity === 0) {
      await transaction.query(
        `UPDATE public.cart_line_item SET deleted_at = now(), updated_at = now() WHERE id = $1`,
        [lineId],
      );
      return { updated: false, removed: true };
    }
    await transaction.query(
      `UPDATE public.cart_line_item SET quantity = $1, updated_at = now() WHERE id = $2`,
      [quantity, lineId],
    );
    return { updated: true, removed: false };
  });
}

export async function handleCartLineQuantityRequest(
  request: Request,
  database: WorkerDatabaseClient,
  cartId: string,
  lineId: string,
): Promise<Response> {
  if (request.method !== "PUT" && request.method !== "PATCH")
    return jsonResponse({ error: "method_not_allowed" }, 405);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return jsonResponse({ error: "idempotency_key_required" }, 400);
  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("quantity" in parsed) ||
    typeof parsed.quantity !== "number"
  )
    return jsonResponse({ error: "invalid_cart_quantity" }, 400);
  const quantity = parsed.quantity;
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10_000)
    return jsonResponse({ error: "invalid_cart_quantity" }, 400);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    key,
    await requestHash(request, body),
    async () => {
      try {
        const outcome = await updateCartLineQuantity(
          cartId,
          lineId,
          quantity,
          database,
        );
        if (!outcome.updated && !outcome.removed)
          return jsonResponse({ error: "cart_line_not_found" }, 404);
        return jsonResponse({
          ok: true,
          updated: outcome.updated ? 1 : 0,
          removed: outcome.removed ? 1 : 0,
          quantity,
        });
      } catch (error) {
        const message = safeCartError(error, "cart_line_update_failed");
        return jsonResponse(
          { error: message },
          message === "insufficient_stock" ? 409 : 422,
        );
      }
    },
  );
  return result.response;
}

export async function addCartLine(
  cartId: string,
  variantId: string,
  quantity: number,
  database: WorkerDatabaseClient,
): Promise<{ lineId: string; quantity: number; unitPrice: number }> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000)
    throw new Error("invalid_cart_quantity");
  return withWorkerTransaction(database, async (transaction) => {
    const result = await transaction.query<AddLineRow>(
      `SELECT c.id AS cart_id, c.currency_code, p.id AS product_id, p.title AS product_title,
              p.handle AS product_handle, p.description AS product_description, p.thumbnail,
              v.id AS variant_id, v.title AS variant_title, v.sku AS variant_sku, v.allow_backorder,
              (SELECT pr.amount FROM public.product_variant_price_set pvps
               JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
               WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL AND pr.deleted_at IS NULL
                 AND pr.currency_code = c.currency_code AND (pr.min_quantity IS NULL OR pr.min_quantity <= $3)
                 AND (pr.max_quantity IS NULL OR pr.max_quantity >= $3)
               ORDER BY pr.amount ASC LIMIT 1) AS unit_price,
              COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
               FROM public.product_variant_inventory_item pvi
               JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
               WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL), 0) AS available_quantity
       FROM public.cart c
       JOIN public.product_variant v ON v.id = $2 AND v.deleted_at IS NULL
       JOIN public.product p ON p.id = v.product_id AND p.status = 'published' AND p.deleted_at IS NULL
       WHERE c.id = $1 AND c.deleted_at IS NULL AND c.completed_at IS NULL
       FOR UPDATE OF c`,
      [cartId, variantId, quantity],
    );
    const row = result.rows[0];
    if (!row) throw new Error("cart_or_variant_not_found");
    const unitPrice = Number(row.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      throw new Error("variant_price_unavailable");
    if (!row.allow_backorder && Number(row.available_quantity) < quantity)
      throw new Error("insufficient_stock");
    const lineId = `line_${crypto.randomUUID()}`;
    await transaction.query(
      `INSERT INTO public.cart_line_item
       (id, cart_id, title, subtitle, thumbnail, quantity, variant_id, product_id, product_title,
        product_description, product_handle, variant_sku, variant_title, unit_price, raw_unit_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $3, $9, $10, $11, $12, $13, jsonb_build_object('value', $13::numeric))`,
      [
        lineId,
        cartId,
        row.product_title,
        null,
        row.thumbnail,
        quantity,
        row.variant_id,
        row.product_id,
        row.product_description,
        row.product_handle,
        row.variant_sku,
        row.variant_title,
        unitPrice,
      ],
    );
    return { lineId, quantity, unitPrice };
  });
}

export async function handleAddCartLineRequest(
  request: Request,
  database: WorkerDatabaseClient,
  cartId: string,
): Promise<Response> {
  if (request.method !== "POST")
    return jsonResponse({ error: "method_not_allowed" }, 405);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return jsonResponse({ error: "idempotency_key_required" }, 400);
  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("variant_id" in parsed) ||
    typeof parsed.variant_id !== "string"
  )
    return jsonResponse({ error: "invalid_cart_line" }, 400);
  const variantId = parsed.variant_id;
  const quantity =
    "quantity" in parsed && typeof parsed.quantity === "number"
      ? parsed.quantity
      : 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000)
    return jsonResponse({ error: "invalid_cart_quantity" }, 400);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    key,
    await requestHash(request, body),
    async () => {
      try {
        const line = await addCartLine(cartId, variantId, quantity, database);
        return jsonResponse({ cart: { id: cartId }, line_item: line });
      } catch (error) {
        const message = safeCartError(error, "cart_line_add_failed");
        const status =
          message === "insufficient_stock"
            ? 409
            : message.endsWith("not_found")
              ? 404
              : 422;
        return jsonResponse({ error: message }, status);
      }
    },
  );
  return result.response;
}
