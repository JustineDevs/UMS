import { withWorkerDatabase, type WorkerDatabaseClient, type WorkerDatabaseEnv } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

export type WishlistEnv = WorkerDatabaseEnv & {
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
  databaseFactory?: (role: "app" | "medusa") => WorkerDatabaseClient;
};

type Row = Record<string, unknown>;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function withDb<T>(env: WishlistEnv, role: "app" | "medusa", operation: (db: WorkerDatabaseClient) => Promise<T>): Promise<T> {
  if (!env.databaseFactory) return withWorkerDatabase(env, operation, role);
  const db = env.databaseFactory(role);
  try { return await operation(db); } finally { await db.end(); }
}

function emailFromClaims(claims: Record<string, unknown>): string | null {
  const email = claims.email;
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    ? email.trim().toLowerCase()
    : null;
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    const raw = await request.text();
    if (raw.length > 64 * 1024) return null;
    return JSON.parse(raw) as unknown;
  } catch { return null; }
}

function productId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value.trim()) ? value.trim() : null;
}

async function customerId(db: WorkerDatabaseClient, email: string): Promise<string | null> {
  const result = await db.query<Row>(
    `SELECT id FROM public.customer WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
    [email],
  );
  return typeof result.rows[0]?.id === "string" ? result.rows[0].id : null;
}

async function canonicalProduct(db: WorkerDatabaseClient, id: string): Promise<Row | null> {
  const result = await db.query<Row>(
    `SELECT p.id, p.handle, p.title FROM public.product p WHERE p.id = $1 AND p.deleted_at IS NULL AND p.status = 'published' LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function canonicalItems(app: WorkerDatabaseClient, medusa: WorkerDatabaseClient, id: string): Promise<unknown[]> {
  const rows = await app.query<Row>(
    `SELECT medusa_product_id, product_slug, product_name, added_at FROM public.wishlists WHERE medusa_customer_id = $1 ORDER BY added_at DESC LIMIT 200`,
    [id],
  );
  const items: unknown[] = [];
  for (const row of rows.rows) {
    const product = typeof row.medusa_product_id === "string" ? await canonicalProduct(medusa, row.medusa_product_id) : null;
    if (!product) continue;
    items.push({
      product_slug: product.handle,
      product_name: product.title,
      medusa_product_id: product.id,
      added_at: row.added_at,
    });
  }
  return items;
}

async function handleGet(request: Request, env: WishlistEnv, email: string): Promise<Response> {
  return withDb(env, "medusa", async (medusa) => {
    const id = await customerId(medusa, email);
    if (!id) return json({ error: "not_found" }, 404);
    return json({ items: await withDb(env, "app", (app) => canonicalItems(app, medusa, id)) });
  });
}

export async function handleWishlistRequest(request: Request, env: WishlistEnv, sync = false): Promise<Response> {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  const email = claims ? emailFromClaims(claims) : null;
  if (!email) return json({ error: "unauthorized" }, 401);
  if (request.method === "GET") return handleGet(request, env, email);

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_json" }, 400);
  const input = body as Record<string, unknown>;
  const requested = sync
    ? Array.isArray(input.items) && input.items.length <= 200
      ? input.items.map((item) => productId(item && typeof item === "object" ? (item as Record<string, unknown>).medusaProductId : null)).filter((id): id is string => Boolean(id))
      : null
    : productId(input.medusaProductId);
  if (!requested || (Array.isArray(requested) && requested.length !== (input.items as unknown[]).length)) return json({ error: "invalid_wishlist_item" }, 400);
  const productIds = Array.isArray(requested) ? requested : [requested];
  return withDb(env, "medusa", async (medusa) => {
    const id = await customerId(medusa, email);
    if (!id) return json({ error: "not_found" }, 404);
    const products = (await Promise.all(productIds.map((value) => canonicalProduct(medusa, value)))).filter((value): value is Row => Boolean(value));
    const skippedProductIds = productIds.filter((value) => !products.some((product) => product.id === value));
    return withDb(env, "app", async (app) => {
      if (request.method === "POST" && products.length) {
        if (sync) {
          await app.query(`INSERT INTO public.wishlists (medusa_customer_id, product_slug, product_name, medusa_product_id) SELECT x.customer_id, x.product_slug, x.product_name, x.product_id FROM jsonb_to_recordset($1::jsonb) AS x(customer_id text, product_slug text, product_name text, product_id text) ON CONFLICT (medusa_customer_id, medusa_product_id) DO NOTHING`, [JSON.stringify(products.map((product) => ({ customer_id: id, product_slug: product.handle, product_name: product.title, product_id: product.id })))]);
        } else {
          const product = products[0];
          await app.query(`INSERT INTO public.wishlists (medusa_customer_id, product_slug, product_name, medusa_product_id) VALUES ($1, $2, $3, $4) ON CONFLICT (medusa_customer_id, medusa_product_id) DO UPDATE SET product_slug = EXCLUDED.product_slug, product_name = EXCLUDED.product_name, added_at = now()`, [id, product.handle, product.title, product.id]);
        }
        return json(sync ? { ok: true, items: await canonicalItems(app, medusa, id), skippedProductIds } : { ok: true });
      }
      if (request.method === "DELETE") {
        if (Array.isArray(requested)) return json({ error: "invalid_wishlist_item" }, 400);
        const result = await app.query(`DELETE FROM public.wishlists WHERE medusa_customer_id = $1 AND medusa_product_id = $2`, [id, requested]);
        return json({ ok: true, removed: (result.rowCount ?? 0) > 0 });
      }
      return json({ error: "method_not_allowed" }, 405);
    });
  });
}
