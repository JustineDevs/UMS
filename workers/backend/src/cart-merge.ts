import { cartMergePostBodySchema, medusaCartIdSchema } from "../../../packages/validation/src/http-schemas.ts";
import { verifyWorkerBearerToken } from "./auth.ts";
import type { WorkerDatabaseClient, WorkerDatabaseEnv } from "./database.ts";
import { withWorkerDatabase, withWorkerTransaction } from "./database.ts";
import { minorToMajor } from "./money.ts";

type CartMergeEnv = WorkerDatabaseEnv & {
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
  databaseFactory?: (_role: "app" | "medusa") => WorkerDatabaseClient;
};
type Row = Record<string, unknown>;
type MergeOutcome = "not_found" | "owner_mismatch" | "quantity_limit" | "line_limit" | "insufficient_stock" | "variant_unavailable" | "merged" | "already_merged";

class CartMergeOutcomeError extends Error {
  constructor(readonly outcome: Exclude<MergeOutcome, "merged" | "already_merged">) {
    super(outcome);
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function withDb<T>(
  env: CartMergeEnv,
  role: "app" | "medusa",
  operation: (_database: WorkerDatabaseClient) => Promise<T>,
): Promise<T> {
  if (!env.databaseFactory) return withWorkerDatabase(env, operation, role);
  const database = env.databaseFactory(role);
  try {
    return await operation(database);
  } finally {
    await database.end();
  }
}

function emailFromClaims(claims: Record<string, unknown>): string | null {
  const email = claims.email;
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    ? email.trim().toLowerCase()
    : null;
}

function parseMergeInput(value: unknown): { cartId: string; mergeKey: string; guestLines: Array<{ variantId: string; quantity: number }> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const parsed = cartMergePostBodySchema.safeParse({ mergeKey: input.mergeKey, guestLines: input.guestLines });
  const cart = medusaCartIdSchema.safeParse(input.cartId);
  if (!parsed.success || !cart.success || !parsed.data.guestLines?.length) return null;
  return { cartId: cart.data, mergeKey: parsed.data.mergeKey, guestLines: parsed.data.guestLines };
}

async function currentCartLines(database: WorkerDatabaseClient, cartId: string): Promise<Array<Record<string, unknown>>> {
  const result = await database.query<Row>(
    `SELECT i.variant_id, i.quantity, i.product_handle AS slug, i.title AS name,
            i.variant_sku AS sku, i.unit_price, i.thumbnail, c.currency_code
       FROM public.cart c
       JOIN public.cart_line_item i ON i.cart_id = c.id AND i.deleted_at IS NULL
      WHERE c.id = $1 AND c.deleted_at IS NULL AND c.completed_at IS NULL
      ORDER BY i.created_at, i.id`,
    [cartId],
  );
  const currencyCode = String(result.rows[0]?.currency_code ?? "php").toUpperCase();
  return result.rows.map((line) => ({
    variantId: String(line.variant_id),
    quantity: Math.floor(Number(line.quantity)),
    slug: typeof line.slug === "string" ? line.slug : "item",
    name: typeof line.name === "string" ? line.name : "Item",
    sku: typeof line.sku === "string" && line.sku.trim() ? line.sku : String(line.variant_id).slice(-8),
    type: "",
    finish: "",
    price: Math.round(minorToMajor(Number(line.unit_price ?? 0), currencyCode) * 1_000_000) / 1_000_000,
    currencyCode,
    ...(typeof line.thumbnail === "string" && line.thumbnail.trim() ? { thumbnail: line.thumbnail.trim() } : {}),
  }));
}

async function mergeInCommerceDatabase(
  database: WorkerDatabaseClient,
  cartId: string,
  email: string,
  mergeKey: string,
  guestLines: Array<{ variantId: string; quantity: number }>,
): Promise<MergeOutcome> {
  try {
    return await withWorkerTransaction(database, async (transaction) => {
    const cartResult = await transaction.query<Row>(
      `SELECT id, email, currency_code, metadata FROM public.cart
        WHERE id = $1 AND deleted_at IS NULL AND completed_at IS NULL FOR UPDATE`,
      [cartId],
    );
    const cart = cartResult.rows[0];
    if (!cart) throw new CartMergeOutcomeError("not_found");
    if (typeof cart.email === "string" && cart.email.trim() && cart.email.trim().toLowerCase() !== email)
      throw new CartMergeOutcomeError("owner_mismatch");
    const metadata = cart.metadata && typeof cart.metadata === "object" && !Array.isArray(cart.metadata)
      ? cart.metadata as Record<string, unknown>
      : {};
    if (metadata.storefront_guest_merge_key === mergeKey) return "already_merged";

    const existingResult = await transaction.query<Row>(
      `SELECT id, variant_id, quantity FROM public.cart_line_item
        WHERE cart_id = $1 AND deleted_at IS NULL ORDER BY created_at, id FOR UPDATE`,
      [cartId],
    );
    const existingByVariant = new Map<string, Array<{ id: string; quantity: number }>>();
    for (const line of existingResult.rows) {
      const variantId = typeof line.variant_id === "string" ? line.variant_id : "";
      const id = typeof line.id === "string" ? line.id : "";
      const quantity = Number(line.quantity);
      if (!id || !variantId || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("invalid_existing_cart_line");
      const group = existingByVariant.get(variantId) ?? [];
      group.push({ id, quantity });
      existingByVariant.set(variantId, group);
    }
    const additions = new Map<string, number>();
    for (const variantId of existingByVariant.keys()) additions.set(variantId, 0);
    for (const line of guestLines) additions.set(line.variantId, (additions.get(line.variantId) ?? 0) + line.quantity);
    if (additions.size > 100) throw new CartMergeOutcomeError("line_limit");

    const currencyCode = String(cart.currency_code ?? "php").toLowerCase();
    const prepared: Array<{
      quantity: number;
      prior: Array<{ id: string; quantity: number }>;
      catalog: Row;
    }> = [];
    for (const [variantId, addedQuantity] of additions) {
      const prior = existingByVariant.get(variantId) ?? [];
      const quantity = prior.reduce((sum, line) => sum + line.quantity, 0) + addedQuantity;
      if (quantity > 1000) throw new CartMergeOutcomeError("quantity_limit");
      const catalog = await transaction.query<Row>(
        `SELECT p.id AS product_id, p.title AS product_title, p.handle AS product_handle,
                p.description AS product_description, p.thumbnail, v.id AS variant_id,
                v.title AS variant_title, v.sku AS variant_sku, v.allow_backorder,
                (SELECT pr.amount FROM public.product_variant_price_set pvps
                  JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
                 WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL AND pr.deleted_at IS NULL
                   AND pr.currency_code = $2
                   AND (pr.min_quantity IS NULL OR pr.min_quantity <= $3)
                   AND (pr.max_quantity IS NULL OR pr.max_quantity >= $3)
                 ORDER BY pr.amount ASC LIMIT 1) AS unit_price,
                COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
                  FROM public.product_variant_inventory_item pvi
                  JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
                 WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL), 0) AS available_quantity
           FROM public.product_variant v
           JOIN public.product p ON p.id = v.product_id AND p.status = 'published' AND p.deleted_at IS NULL
          WHERE v.id = $1 AND v.deleted_at IS NULL LIMIT 1`,
        [variantId, currencyCode, quantity],
      );
      const item = catalog.rows[0];
      if (!item || item.unit_price === null || !Number.isFinite(Number(item.unit_price)))
        throw new CartMergeOutcomeError("variant_unavailable");
      if (!item.allow_backorder && Number(item.available_quantity) < quantity)
        throw new CartMergeOutcomeError("insufficient_stock");
      prepared.push({ quantity, prior, catalog: item });
    }

    for (const { quantity, prior, catalog: item } of prepared) {
      if (prior.length) {
        await transaction.query(
          `UPDATE public.cart_line_item SET quantity = $1, updated_at = now() WHERE id = $2 AND cart_id = $3`,
          [quantity, prior[0].id, cartId],
        );
        if (prior.length > 1) {
          await transaction.query(
            `UPDATE public.cart_line_item SET deleted_at = now(), updated_at = now()
              WHERE cart_id = $1 AND id = ANY($2::text[])`,
            [cartId, prior.slice(1).map((line) => line.id)],
          );
        }
      } else {
        const lineId = `line_${crypto.randomUUID()}`;
        await transaction.query(
          `INSERT INTO public.cart_line_item
             (id, cart_id, title, subtitle, thumbnail, quantity, variant_id, product_id, product_title,
              product_description, product_handle, variant_sku, variant_title, unit_price, raw_unit_price)
           VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $3, $8, $9, $10, $11, $12,
                   jsonb_build_object('value', $12::numeric))`,
          [lineId, cartId, item.product_title, item.thumbnail, quantity, item.variant_id, item.product_id,
            item.product_description, item.product_handle, item.variant_sku, item.variant_title, Number(item.unit_price)],
        );
      }
    }
    await transaction.query(
      `UPDATE public.cart SET email = $2, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb, updated_at = now()
        WHERE id = $1`,
      [cartId, email, JSON.stringify({ storefront_guest_merge_key: mergeKey })],
    );
    return "merged";
    });
  } catch (error) {
    if (error instanceof CartMergeOutcomeError) return error.outcome;
    throw error;
  }
}

export async function handleCartMergeRequest(request: Request, env: CartMergeEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  const email = claims ? emailFromClaims(claims) : null;
  if (!claims || !email || (claims.iss === "uvs.internal" && claims.scope !== "storefront:cart-merge"))
    return json({ error: "unauthorized" }, 401);

  let raw: string;
  try { raw = await request.text(); } catch { return json({ error: "invalid_json" }, 400); }
  if (new TextEncoder().encode(raw).byteLength > 64 * 1024) return json({ error: "request_too_large" }, 413);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const input = parseMergeInput(value);
  if (!input) return json({ error: "invalid_cart_merge" }, 400);

  const owner = crypto.randomUUID();
  try {
    return await withDb(env, "app", async (app) => {
      const claimResult = await app.query<Row>(
        `SELECT acquired, replayed, response FROM public.claim_cart_merge($1, $2, $3, 90)`,
        [input.cartId, input.mergeKey, owner],
      );
      const claim = claimResult.rows[0];
      if (claim?.replayed && claim.response && typeof claim.response === "object") {
        const cartResult = await withDb(env, "medusa", (commerce) => commerce.query<Row>(
          `SELECT id, email FROM public.cart
            WHERE id = $1 AND deleted_at IS NULL AND completed_at IS NULL LIMIT 1`,
          [input.cartId],
        ));
        const cart = cartResult.rows[0];
        if (!cart) return json({ error: "cart_not_found" }, 404);
        if (typeof cart.email !== "string" || !cart.email.trim() || cart.email.trim().toLowerCase() !== email)
          return json({ error: "cart_owner_mismatch" }, 403);
        return json({ ...(claim.response as Record<string, unknown>), replayed: true });
      }
      if (claim?.acquired !== true)
        return json({ error: "cart_merge_in_progress", code: "CART_MERGE_IN_PROGRESS" }, 409);

      const release = async () => {
        await app.query(`SELECT public.release_cart_merge($1, $2, $3)`, [input.cartId, input.mergeKey, owner]);
      };
      try {
        const state = await withDb(env, "medusa", (commerce) =>
          mergeInCommerceDatabase(commerce, input.cartId, email, input.mergeKey, input.guestLines));
        if (state === "not_found") { await release(); return json({ error: "cart_not_found" }, 404); }
        if (state === "owner_mismatch") { await release(); return json({ error: "cart_owner_mismatch" }, 403); }
        if (state === "quantity_limit") { await release(); return json({ error: "cart_quantity_limit" }, 409); }
        if (state === "line_limit") { await release(); return json({ error: "cart_line_limit" }, 409); }
        if (state === "insufficient_stock") { await release(); return json({ error: "insufficient_stock" }, 409); }
        if (state === "variant_unavailable") { await release(); return json({ error: "variant_unavailable" }, 409); }
        const lines = await withDb(env, "medusa", (commerce) => currentCartLines(commerce, input.cartId));
        if (lines.length > 100) { await release(); return json({ error: "cart_line_limit" }, 409); }
        const response = { ok: true as const, cartId: input.cartId, lines };
        const completed = await app.query<{ complete_cart_merge: boolean }>(
          `SELECT public.complete_cart_merge($1, $2, $3, $4::jsonb) AS complete_cart_merge`,
          [input.cartId, input.mergeKey, owner, JSON.stringify(response)],
        );
        if (completed.rows[0]?.complete_cart_merge !== true)
          return json({ error: "cart_merge_completion_pending" }, 503);
        return json({ ...response, ...(state === "already_merged" ? { replayed: true } : {}) });
      } catch (error) {
        try { await release(); } catch { /* lease expires after its bounded TTL */ }
        console.error("cart_merge_failed", error instanceof Error ? error.message : "unknown_error");
        return json({ error: "cart_merge_unavailable" }, 503);
      }
    });
  } catch {
    return json({ error: "cart_merge_unavailable" }, 503);
  }
}
