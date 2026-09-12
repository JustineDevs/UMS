import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";

type PaymentAttempt = {
  correlation_id: string;
  cart_id: string;
  provider: string;
  amount_minor: number | string | null;
  currency: string | null;
  provider_payment_id: string | null;
  provider_payload: Record<string, unknown> | null;
  status: string;
  medusa_order_id: string | null;
};

type Cart = {
  id: string;
  region_id: string | null;
  customer_id: string | null;
  sales_channel_id: string | null;
  email: string | null;
  currency_code: string;
  shipping_address_id: string | null;
  billing_address_id: string | null;
  metadata: Record<string, unknown> | null;
};

type CartLine = {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
  quantity: number;
  variant_id: string | null;
  product_id: string | null;
  product_title: string | null;
  product_description: string | null;
  product_subtitle: string | null;
  product_type: string | null;
  product_collection: string | null;
  product_handle: string | null;
  variant_sku: string | null;
  variant_barcode: string | null;
  variant_title: string | null;
  variant_option_values: Record<string, unknown> | null;
  requires_shipping: boolean;
  is_discountable: boolean;
  is_tax_inclusive: boolean;
  compare_at_unit_price: string | null;
  raw_compare_at_unit_price: Record<string, unknown> | null;
  unit_price: string;
  raw_unit_price: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  product_type_id: string | null;
  is_custom_price: boolean;
  is_giftcard: boolean;
};

const PAID_STATUSES = new Set(["paid", "completed", "captured"]);

function providerId(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(normalized)) throw new Error("invalid_payment_provider");
  return `pp_${normalized}_${normalized}`;
}

function rawMoney(value: number): string {
  return JSON.stringify({ value: String(value), precision: 20 });
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Converts one paid cart into the existing Medusa order schema in one transaction.
 * The payment-attempt unique index makes retries return the original order.
 */
export async function finalizeNativeOrder(
  database: WorkerDatabaseClient,
  correlationId: string,
  organizationId?: string,
): Promise<{ orderId: string; replayed: boolean }> {
  return withWorkerTransaction(database, async (transaction) => {
    const attemptResult = await transaction.query<PaymentAttempt>(
      `SELECT correlation_id, cart_id, provider, amount_minor, currency,
              provider_payment_id, provider_payload, status, medusa_order_id
       FROM public.payment_attempts
       WHERE correlation_id = $1::uuid
       FOR UPDATE`,
      [correlationId],
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) throw new Error("payment_attempt_not_found");
    if (attempt.medusa_order_id) return { orderId: attempt.medusa_order_id, replayed: true };
    const codPlacement = attempt.provider?.toLowerCase() === "cod" && attempt.status.toLowerCase() === "initiated";
    if (!PAID_STATUSES.has(attempt.status.toLowerCase()) && !codPlacement)
      throw new Error("payment_not_settled");

    // The APP ledger and Medusa transaction cannot share one PostgreSQL
    // transaction. Reconcile a committed commerce order before retrying the
    // cart path so an APP update failure never creates a duplicate order.
    const recoveredOrder = await transaction.query<{ id: string }>(
      `SELECT id
       FROM public.order
       WHERE metadata->>'worker_payment_correlation_id' = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [correlationId],
    );
    if (recoveredOrder.rows[0]?.id) {
      await transaction.query(
        `UPDATE public.payment_attempts
         SET medusa_order_id = $2, checkout_state = 'completed', finalized_at = COALESCE(finalized_at, now()), updated_at = now()
         WHERE correlation_id = $1::uuid AND medusa_order_id IS NULL`,
        [correlationId, recoveredOrder.rows[0].id],
      );
      return { orderId: recoveredOrder.rows[0].id, replayed: true };
    }

    const cartResult = await transaction.query<Cart>(
      `SELECT id, region_id, customer_id, sales_channel_id, email, currency_code,
              shipping_address_id, billing_address_id, metadata
       FROM public.cart
       WHERE id = $1 AND deleted_at IS NULL AND completed_at IS NULL
       FOR UPDATE`,
      [attempt.cart_id],
    );
    const cart = cartResult.rows[0];
    if (!cart) throw new Error("cart_not_available");

    const linesResult = await transaction.query<CartLine>(
      `SELECT id, title, subtitle, thumbnail, quantity, variant_id, product_id,
              product_title, product_description, product_subtitle, product_type,
              product_collection, product_handle, variant_sku, variant_barcode,
              variant_title, variant_option_values, requires_shipping, is_discountable,
              is_tax_inclusive, compare_at_unit_price, raw_compare_at_unit_price,
              unit_price, raw_unit_price, metadata, product_type_id, is_custom_price,
              is_giftcard
       FROM public.cart_line_item
       WHERE cart_id = $1 AND deleted_at IS NULL
       ORDER BY created_at, id`,
      [cart.id],
    );
    if (linesResult.rows.length === 0) throw new Error("cart_empty");
    const amountMinor = Number(attempt.amount_minor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1)
      throw new Error("payment_amount_invalid");
    if (!attempt.currency || attempt.currency.toLowerCase() !== cart.currency_code.toLowerCase())
      throw new Error("payment_currency_invalid");

    const orderId = id("order");
    const orderResult = await transaction.query(
      `INSERT INTO public.order
         (id, region_id, customer_id, sales_channel_id, email, currency_code,
          shipping_address_id, billing_address_id, metadata, status, is_draft_order)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL,
               $7::jsonb, 'pending', false)
       RETURNING id`,
      [orderId, cart.region_id, cart.customer_id, cart.sales_channel_id, cart.email, cart.currency_code, JSON.stringify({ ...cart.metadata, source: "worker-native", ...(organizationId?.trim() ? { store_id: organizationId.trim() } : {}), worker_payment_correlation_id: correlationId })],
    );
    if (orderResult.rowCount !== 1) throw new Error("order_insert_failed");

    const addressMap = new Map<string, string>();
    for (const addressId of [cart.shipping_address_id, cart.billing_address_id]) {
      if (!addressId || addressMap.has(addressId)) continue;
      const copied = await transaction.query<{ id: string }>(
        `INSERT INTO public.order_address
           (id, customer_id, company, first_name, last_name, address_1, address_2,
            city, country_code, province, postal_code, phone, metadata)
         SELECT $1, customer_id, company, first_name, last_name, address_1, address_2,
                city, country_code, province, postal_code, phone, metadata
         FROM public.cart_address
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [id("oaddr"), addressId],
      );
      if (copied.rowCount !== 1) throw new Error("cart_address_not_found");
      addressMap.set(addressId, copied.rows[0].id);
    }
    await transaction.query(
      `UPDATE public.order
       SET shipping_address_id = $2, billing_address_id = $3, updated_at = now()
       WHERE id = $1`,
      [orderId, cart.shipping_address_id ? addressMap.get(cart.shipping_address_id) : null, cart.billing_address_id ? addressMap.get(cart.billing_address_id) : null],
    );

    for (const line of linesResult.rows) {
      const lineId = id("oli");
      await transaction.query(
        `INSERT INTO public.order_line_item
           (id, title, subtitle, thumbnail, variant_id, product_id, product_title,
            product_description, product_subtitle, product_type, product_collection,
            product_handle, variant_sku, variant_barcode, variant_title,
            variant_option_values, requires_shipping, is_discountable, is_tax_inclusive,
            compare_at_unit_price, raw_compare_at_unit_price, unit_price,
            raw_unit_price, metadata, product_type_id, is_custom_price, is_giftcard)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16::jsonb, $17, $18, $19, $20, $21::jsonb, $22,
                 $23::jsonb, $24::jsonb, $25, $26, $27)`,
        [lineId, line.title, line.subtitle, line.thumbnail, line.variant_id, line.product_id, line.product_title, line.product_description, line.product_subtitle, line.product_type, line.product_collection, line.product_handle, line.variant_sku, line.variant_barcode, line.variant_title, JSON.stringify(line.variant_option_values ?? {}), line.requires_shipping, line.is_discountable, line.is_tax_inclusive, line.compare_at_unit_price, JSON.stringify(line.raw_compare_at_unit_price ?? {}), line.unit_price, JSON.stringify(line.raw_unit_price), JSON.stringify(line.metadata ?? {}), line.product_type_id, line.is_custom_price, line.is_giftcard],
      );
      await transaction.query(
        `INSERT INTO public.order_item
           (id, order_id, item_id, quantity, raw_quantity, version,
            fulfilled_quantity, shipped_quantity, return_requested_quantity,
            return_received_quantity, return_dismissed_quantity, written_off_quantity)
         VALUES ($1, $2, $3, $4, $5::jsonb, 1, 0, 0, 0, 0, 0, 0)`,
        [id("oit"), orderId, lineId, line.quantity, JSON.stringify({ value: line.quantity, precision: 20 })],
      );
    }

    const paymentCollectionId = id("paycol");
    const paymentCollection = await transaction.query<{ id: string }>(
      `INSERT INTO public.payment_collection
         (id, currency_code, amount, raw_amount, authorized_amount,
          raw_authorized_amount, captured_amount, raw_captured_amount,
          status, metadata, completed_at)
       VALUES ($1, $2, $3, $4::jsonb, $3, $4::jsonb, $3, $4::jsonb,
               'completed', $5::jsonb, now())
       RETURNING id`,
      [
        paymentCollectionId,
        cart.currency_code,
        amountMinor,
        rawMoney(amountMinor),
        JSON.stringify({
          source: "worker-native",
          provider: attempt.provider,
          correlationId,
        }),
      ],
    );
    if (paymentCollection.rowCount !== 1) throw new Error("payment_collection_insert_failed");
    await transaction.query(
      `INSERT INTO public.payment_collection_payment_providers
         (payment_collection_id, payment_provider_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [paymentCollectionId, providerId(attempt.provider)],
    );
    const paymentSessionId = id("paysess");
    await transaction.query(
      `INSERT INTO public.payment_session
         (id, currency_code, amount, raw_amount, provider_id, data,
          status, authorized_at, payment_collection_id, metadata)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, 'authorized', now(), $7, $8::jsonb)`,
      [
        paymentSessionId,
        cart.currency_code,
        amountMinor,
        rawMoney(amountMinor),
        providerId(attempt.provider),
        JSON.stringify({
          correlationId,
          providerPaymentId: attempt.provider_payment_id,
          providerPayload: attempt.provider_payload ?? {},
        }),
        paymentCollectionId,
        JSON.stringify({ source: "worker-native" }),
      ],
    );
    await transaction.query(
      `INSERT INTO public.payment
         (id, amount, raw_amount, currency_code, provider_id, data,
          created_at, captured_at, payment_collection_id, payment_session_id, metadata)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, now(), now(), $7, $8, $9::jsonb)`,
      [
        id("payment"),
        amountMinor,
        rawMoney(amountMinor),
        cart.currency_code,
        providerId(attempt.provider),
        JSON.stringify({
          correlationId,
          providerPaymentId: attempt.provider_payment_id,
          providerPayload: attempt.provider_payload ?? {},
        }),
        paymentCollectionId,
        paymentSessionId,
        JSON.stringify({ source: "worker-native" }),
      ],
    );
    await transaction.query(
      `INSERT INTO public.order_payment_collection
         (id, order_id, payment_collection_id)
       VALUES ($1, $2, $3)`,
      [id("opaycol"), orderId, paymentCollectionId],
    );

    await transaction.query(
      `UPDATE public.cart SET completed_at = now(), updated_at = now() WHERE id = $1`,
      [cart.id],
    );
    await transaction.query(
      `UPDATE public.payment_attempts
       SET medusa_order_id = $2, checkout_state = 'completed', finalized_at = now(), updated_at = now()
       WHERE correlation_id = $1::uuid AND medusa_order_id IS NULL`,
      [correlationId, orderId],
    );
    return { orderId, replayed: false };
  });
}

/**
 * Bridges the current two-database topology while the finalization ledger is
 * being consolidated. Commerce writes remain in the Medusa transaction;
 * payment-attempt reads/updates are routed to APP explicitly instead of
 * accidentally querying the commerce database for an APP table.
 */
export async function finalizeNativeOrderAcrossDatabases(
  appDatabase: WorkerDatabaseClient,
  commerceDatabase: WorkerDatabaseClient,
  correlationId: string,
  organizationId?: string,
): Promise<{ orderId: string; replayed: boolean }> {
  const claim = await appDatabase.query<PaymentAttempt>(
    `UPDATE public.payment_attempts
     SET checkout_state = 'finalizing', finalize_attempts = COALESCE(finalize_attempts, 0) + 1, updated_at = now()
     WHERE correlation_id = $1::uuid
       AND (
         status IN ('paid', 'completed', 'captured')
         OR (provider = 'cod' AND status = 'initiated')
       )
       AND medusa_order_id IS NULL
       AND (
         checkout_state <> 'finalizing'
         OR updated_at < now() - interval '10 minutes'
       )
     RETURNING correlation_id, cart_id, provider, amount_minor, currency,
               provider_payment_id, provider_payload, status, medusa_order_id`,
    [correlationId],
  );
  if (claim.rowCount !== 1) {
    const existing = await appDatabase.query<{ medusa_order_id: string | null }>(
      `SELECT medusa_order_id FROM public.payment_attempts WHERE correlation_id = $1::uuid`,
      [correlationId],
    );
    if (existing.rows[0]?.medusa_order_id) return { orderId: existing.rows[0].medusa_order_id, replayed: true };
    throw new Error("payment_finalization_in_progress");
  }
  const splitClient: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      return /public\.payment_attempts\b/i.test(text)
        ? appDatabase.query<T>(text, values)
        : commerceDatabase.query<T>(text, values);
    },
    async end() {},
  };
  try {
    return await finalizeNativeOrder(splitClient, correlationId, organizationId);
  } catch (error) {
    await appDatabase.query(
      `UPDATE public.payment_attempts
       SET checkout_state = 'needs_review', last_error = $2, updated_at = now()
       WHERE correlation_id = $1::uuid AND medusa_order_id IS NULL`,
      [correlationId, error instanceof Error ? error.message : "payment_finalization_failed"],
    );
    throw error;
  }
}

export async function handleNativeOrderFinalizationRequest(
  request: Request,
  database: WorkerDatabaseClient,
  correlationId: string,
  appDatabase?: WorkerDatabaseClient,
  organizationId?: string,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const result = appDatabase
      ? await finalizeNativeOrderAcrossDatabases(appDatabase, database, correlationId, organizationId)
      : await finalizeNativeOrder(database, correlationId, organizationId);
    return json(result, result.replayed ? 200 : 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : "order_finalization_failed";
    const status = code === "payment_not_settled" || code === "payment_finalization_in_progress"
      ? 409
      : code === "payment_attempt_not_found"
        ? 404
        : 422;
    return json(
      { error: code, ...(code === "payment_finalization_in_progress" ? { code: "FINALIZE_IN_PROGRESS" } : {}) },
      status,
    );
  }
}
