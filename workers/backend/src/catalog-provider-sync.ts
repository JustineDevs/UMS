import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";
import type { WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string; STRIPE_API_KEY?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function obj(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, max = 500): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function allowed(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "admin" || claims.role === "owner" || permissions.includes("*") || permissions.includes("catalog:write"); }
async function stripe(env: Env, path: string, form: URLSearchParams, key: string, method = "POST"): Promise<Record<string, unknown>> {
  if (!env.STRIPE_API_KEY?.trim()) throw new Error("stripe_not_configured");
  const response = await fetch(`https://api.stripe.com${path}`, { method, headers: { Authorization: `Bearer ${env.STRIPE_API_KEY.trim()}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": key }, body: method === "GET" ? undefined : form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !obj(body)) throw new Error(`stripe_request_failed:${response.status}`);
  return body;
}
async function projection(database: WorkerDatabaseClient, productId: string, artifact: string, externalId: string | null, externalUrl: string | null, state: string, key: string, error: string | null, email: string | null): Promise<void> {
  await database.query(`INSERT INTO public.catalog_provider_projections (medusa_product_id,provider,artifact_type,external_id,external_url,sync_state,sync_mode,idempotency_key,last_error,last_error_code,last_synced_at,updated_by_email) VALUES ($1,'stripe',$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $5='synced' THEN now() ELSE NULL END,$10) ON CONFLICT (medusa_product_id,provider,artifact_type) DO UPDATE SET external_id=EXCLUDED.external_id, external_url=EXCLUDED.external_url, sync_state=EXCLUDED.sync_state, sync_mode=EXCLUDED.sync_mode, idempotency_key=EXCLUDED.idempotency_key, last_error=EXCLUDED.last_error, last_error_code=EXCLUDED.last_error_code, last_synced_at=EXCLUDED.last_synced_at, updated_by_email=EXCLUDED.updated_by_email`, [productId, artifact, externalId, externalUrl, state, state === "disabled" ? "disabled" : "automatic", key, error, error ? "STRIPE_CATALOG_SYNC_FAILED" : null, email]);
}
async function digest(raw: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function performCatalogProviderSyncRequest(request: Request, app: WorkerDatabaseClient, env: Env): Promise<Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !allowed(claims)) return json({ error: "unauthorized" }, 401);
  const raw = await request.text(); if (raw.length > 64 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_provider_sync_payload" }, 400); }
  if (!obj(value)) return json({ error: "invalid_provider_sync_payload" }, 400);
  const productId = text(value.productId, 160);
  const headerKey = request.headers.get("Idempotency-Key")?.trim() || "";
  const bodyKey = text(value.idempotencyKey, 200);
  if (bodyKey && bodyKey !== headerKey) return json({ error: "idempotency_key_mismatch", code: "IDEMPOTENCY_KEY_MISMATCH" }, 409);
  const key = headerKey;
  if (!productId || !key) return json({ error: "product_id_and_idempotency_key_required" }, 400);
  const email = typeof claims.email === "string" ? claims.email : null;
  if (request.method === "DELETE") {
    const ids = ["productExternalId", "priceExternalId", "paymentLinkExternalId"].map((field) => text(value[field], 200)).filter(Boolean);
    try {
      const owned = await app.query<{ artifact_type: string; external_id: string | null }>("SELECT artifact_type, external_id FROM public.catalog_provider_projections WHERE medusa_product_id=$1 AND provider='stripe' AND external_id IS NOT NULL", [productId]);
      const ownedByType = new Map(owned.rows.map((row) => [row.artifact_type, row.external_id]));
      const requested: Array<[string, string]> = [
        ["product", text(value.productExternalId)],
        ["price", text(value.priceExternalId)],
        ["payment_link", text(value.paymentLinkExternalId)],
      ].filter(([, externalId]) => Boolean(externalId)) as Array<[string, string]>;
      if (!requested.length || requested.some(([type, externalId]) => ownedByType.get(type) !== externalId)) return json({ error: "provider_artifact_not_owned", code: "PROVIDER_ARTIFACT_NOT_OWNED" }, 409);
      for (const id of ids) {
        const type = id === text(value.productExternalId) ? "product" : id === text(value.priceExternalId) ? "price" : "payment_link";
        if (type === "product") await stripe(env, `/v1/products/${encodeURIComponent(id)}`, new URLSearchParams({ active: "false" }), `${key}:archive:${type}`);
        if (type === "price") await stripe(env, `/v1/prices/${encodeURIComponent(id)}`, new URLSearchParams({ active: "false" }), `${key}:archive:${type}`);
        if (type === "payment_link") await stripe(env, `/v1/payment_links/${encodeURIComponent(id)}`, new URLSearchParams({ active: "false" }), `${key}:archive:${type}`);
      }
      const externalIds: Record<string, string> = {
        product: text(value.productExternalId),
        price: text(value.priceExternalId),
        payment_link: text(value.paymentLinkExternalId),
      };
      for (const artifact of ["product", "price", "payment_link"])
        await projection(app, productId, artifact, externalIds[artifact] || null, null, "disabled", key, null, email);
      return json({ data: { archived: true, productId } });
    } catch (error) { return json({ error: error instanceof Error ? error.message : "provider_archive_failed", code: "PROVIDER_ARCHIVE_FAILED" }, 502); }
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const title = text(value.title); const amountMinor = Number(value.amountMinor);
  if (!title || !Number.isSafeInteger(amountMinor) || amountMinor < 1) return json({ error: "invalid_provider_sync_payload" }, 400);
  let productIdExternal = text(value.productExternalId, 200) || null;
  let priceId: string | null = text(value.priceExternalId, 200) || null;
  let linkId: string | null = text(value.paymentLinkExternalId, 200) || null;
  try {
    const productForm = new URLSearchParams({ name: title });
    const description = text(value.description, 4000);
    const handle = text(value.handle, 200);
    if (description) productForm.set("description", description);
    if (handle) productForm.set("metadata[handle]", handle);
    const existingProductId = text(value.productExternalId, 200);
    const product = await stripe(env, existingProductId ? `/v1/products/${encodeURIComponent(existingProductId)}` : "/v1/products", productForm, `${key}:product`);
    productIdExternal = text(product.id, 200); if (!productIdExternal) throw new Error("stripe_product_id_missing");
    const price = await stripe(env, "/v1/prices", new URLSearchParams({ currency: text(value.currency, 3).toLowerCase() || "php", unit_amount: String(amountMinor), product: productIdExternal }), `${key}:price`);
    priceId = text(price.id, 200); if (!priceId) throw new Error("stripe_price_id_missing");
    const linkForm = new URLSearchParams();
    linkForm.set("line_items[0][price]", priceId);
    linkForm.set("line_items[0][quantity]", "1");
    const link = await stripe(env, "/v1/payment_links", linkForm, `${key}:payment-link`);
    linkId = text(link.id, 200); const linkUrl = text(link.url, 2000);
    const previousPriceId = text(value.priceExternalId, 200);
    if (previousPriceId && previousPriceId !== priceId) await stripe(env, `/v1/prices/${encodeURIComponent(previousPriceId)}`, new URLSearchParams({ active: "false" }), `${key}:archive:price`);
    const previousLinkId = text(value.paymentLinkExternalId, 200);
    if (previousLinkId && previousLinkId !== linkId) await stripe(env, `/v1/payment_links/${encodeURIComponent(previousLinkId)}`, new URLSearchParams({ active: "false" }), `${key}:archive:payment-link`);
    await projection(app, productId, "product", productIdExternal, null, "synced", key, null, email);
    await projection(app, productId, "price", priceId, null, "synced", key, null, email);
    await projection(app, productId, "payment_link", linkId || null, linkUrl || null, "synced", key, null, email);
    return json({ data: { productId: productIdExternal, priceId, paymentLinkId: linkId || null, paymentLinkUrl: linkUrl || null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "provider_sync_failed";
    for (const [artifact, externalId] of [["product", productIdExternal], ["price", priceId], ["payment_link", linkId]] as const) await projection(app, productId, artifact, externalId, null, "failed", key, message, email).catch(() => undefined);
    return json({ error: message, code: "PROVIDER_SYNC_FAILED" }, 502);
  }
}

export async function handleCatalogProviderSyncRequest(request: Request, app: WorkerDatabaseClient, env: Env): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")?.trim() || "";
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.clone().text();
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(app),
    key,
    await digest(raw),
    () => performCatalogProviderSyncRequest(request, app, env),
  );
  return result.response;
}
