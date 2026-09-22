import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
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
  const response = await fetch(`https://api.stripe.com${path}`, { method, headers: { Authorization: `Bearer ${env.STRIPE_API_KEY.trim()}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": key }, body: method === "GET" ? undefined : form, signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !obj(body)) throw new Error(`stripe_request_failed:${response.status}`);
  return body;
}
async function projection(database: WorkerDatabaseClient, productId: string, artifact: string, externalId: string | null, externalUrl: string | null, state: string, key: string, error: string | null, email: string | null, organizationId?: string): Promise<void> {
  await database.query(`INSERT INTO public.catalog_provider_projections (medusa_product_id,provider,artifact_type,external_id,external_url,sync_state,sync_mode,metadata,idempotency_key,last_error,last_error_code,last_synced_at,updated_by_email) VALUES ($1,'stripe',$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,CASE WHEN $5='synced' THEN now() ELSE NULL END,$11) ON CONFLICT (medusa_product_id,provider,artifact_type) DO UPDATE SET external_id=EXCLUDED.external_id, external_url=EXCLUDED.external_url, sync_state=EXCLUDED.sync_state, sync_mode=EXCLUDED.sync_mode, metadata=EXCLUDED.metadata, idempotency_key=EXCLUDED.idempotency_key, last_error=EXCLUDED.last_error, last_error_code=EXCLUDED.last_error_code, last_synced_at=EXCLUDED.last_synced_at, updated_by_email=EXCLUDED.updated_by_email`, [productId, artifact, externalId, externalUrl, state, state === "disabled" ? "disabled" : "automatic", JSON.stringify(organizationId ? { organization_id: organizationId } : {}), key, error, error ? "STRIPE_CATALOG_SYNC_FAILED" : null, email]);
}
async function digest(raw: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function performCatalogProviderSyncRequest(request: Request, app: WorkerDatabaseClient, env: Env, commerce?: WorkerDatabaseClient): Promise<Response> {
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
  const organizationClaim = claims.organization_id ?? claims.org_id;
  const organizationId = typeof organizationClaim === "string" && organizationClaim.trim() ? organizationClaim.trim() : "";
  if (!organizationId) return json({ error: "organization_scope_required", code: "ORGANIZATION_SCOPE_REQUIRED" }, 403);
  // Provider create/update keys remain stable across retries. State-setting
  // operations need an attempt suffix so a prior compensating action cannot
  // make Stripe replay a stale response instead of applying the new state.
  const attemptId = crypto.randomUUID();
  if (commerce) {
    const owner = await commerce.query<{ id: string }>(
      "SELECT id FROM public.product WHERE id=$1 AND ($3::boolean = false OR deleted_at IS NULL) AND metadata->>'organization_id' = $2 LIMIT 1",
      [productId, organizationId, request.method !== "DELETE"],
    );
    if (!owner.rows[0]) return json({ error: "catalog_product_not_owned", code: "CATALOG_PRODUCT_NOT_OWNED" }, 403);
  }
  if (request.method === "DELETE") {
    try {
      const owned = await app.query<{ artifact_type: string; external_id: string | null }>("SELECT artifact_type, external_id FROM public.catalog_provider_projections WHERE medusa_product_id=$1 AND provider='stripe' AND external_id IS NOT NULL AND metadata->>'organization_id' = $2", [productId, organizationId]);
      const artifacts = owned.rows.flatMap((row) => {
        if (!row.external_id || !["product", "price", "payment_link"].includes(row.artifact_type)) return [];
        return [{ id: row.external_id, type: row.artifact_type, path: row.artifact_type === "payment_link" ? "payment_links" : `${row.artifact_type}s` }];
      }).sort((left, right) => ["product", "price", "payment_link"].indexOf(left.type) - ["product", "price", "payment_link"].indexOf(right.type));
      if (artifacts.length === 0) return json({ data: { archived: false, productId, reason: "no_provider_artifacts" } });
      const archived: typeof artifacts = [];
      try {
        // Disable the checkout surface first, then its price, then the product.
        for (const artifact of [...artifacts].reverse()) {
          await stripe(env, "/v1/" + artifact.path + "/" + encodeURIComponent(artifact.id), new URLSearchParams({ active: "false" }), `${key}:attempt:${attemptId}:archive:${artifact.type}`);
          archived.push(artifact);
        }
        await withWorkerTransaction(app, async (tx) => {
          for (const artifact of artifacts)
            await projection(tx, productId, artifact.type, artifact.id, null, "disabled", key, null, email, organizationId);
        });
      } catch (archiveError) {
        // Stripe calls cannot share a database transaction. Compensate any
        // completed deactivations before exposing an archive failure.
        const rollback = await Promise.allSettled(archived.map((artifact) =>
          stripe(env, "/v1/" + artifact.path + "/" + encodeURIComponent(artifact.id), new URLSearchParams({ active: "true" }), `${key}:attempt:${attemptId}:restore:${artifact.type}`),
        ));
        if (rollback.some((result) => result.status === "rejected")) {
          await withWorkerTransaction(app, async (tx) => {
            for (const artifact of artifacts) {
              await projection(tx, productId, artifact.type, artifact.id, null, "partial", key, "Stripe archive rollback failed; reconcile provider state", email, organizationId);
            }
          }).catch(() => undefined);
          return json({ error: "provider_archive_reconciliation_required", code: "PROVIDER_RECONCILIATION_REQUIRED" }, 502);
        }
        throw archiveError;
      }
      return json({ data: { archived: true, productId } });
    } catch { return json({ error: "provider_archive_failed", code: "PROVIDER_ARCHIVE_FAILED" }, 502); }
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const title = text(value.title); const amountMinor = Number(value.amountMinor);
  if (!title || !Number.isSafeInteger(amountMinor) || amountMinor < 1) return json({ error: "invalid_provider_sync_payload" }, 400);
  let productIdExternal: string | null = null;
  let priceId: string | null = null;
  let linkId: string | null = null;
  let previousProjections: Array<{ artifact_type: string; external_id: string | null; external_url: string | null; sync_state: string; sync_mode: string; metadata: unknown; idempotency_key: string | null; last_error: string | null; last_error_code: string | null; updated_by_email: string | null }> = [];
  try {
    previousProjections = (await app.query<typeof previousProjections[number]>(
        "SELECT artifact_type, external_id, external_url, sync_state, sync_mode, metadata, idempotency_key, last_error, last_error_code, updated_by_email FROM public.catalog_provider_projections WHERE medusa_product_id=$1 AND provider='stripe' AND metadata->>'organization_id' = $2",
        [productId, organizationId],
      )).rows;
    const previousByType = new Map(previousProjections.map((row) => [row.artifact_type, row.external_id]));
    productIdExternal = previousByType.get("product") ?? null;
    priceId = previousByType.get("price") ?? null;
    linkId = previousByType.get("payment_link") ?? null;
    const previousPriceId = priceId;
    const previousLinkId = linkId;
    const productForm = new URLSearchParams({ name: title });
    const description = text(value.description, 4000);
    const handle = text(value.handle, 200);
    if (description) productForm.set("description", description);
    if (handle) productForm.set("metadata[handle]", handle);
    const existingProductId = productIdExternal;
    const product = await stripe(env, existingProductId ? `/v1/products/${encodeURIComponent(existingProductId)}` : "/v1/products", productForm, `${key}:product`);
    productIdExternal = text(product.id, 200); if (!productIdExternal) throw new Error("stripe_product_id_missing");
    const price = await stripe(env, "/v1/prices", new URLSearchParams({ currency: text(value.currency, 3).toLowerCase() || "php", unit_amount: String(amountMinor), product: productIdExternal }), `${key}:price`);
    priceId = text(price.id, 200); if (!priceId) throw new Error("stripe_price_id_missing");
    const linkForm = new URLSearchParams();
    linkForm.set("line_items[0][price]", priceId);
    linkForm.set("line_items[0][quantity]", "1");
    const link = await stripe(env, "/v1/payment_links", linkForm, `${key}:payment-link`);
    linkId = text(link.id, 200); const linkUrl = text(link.url, 2000);
    // Remove the old checkout entry point before deactivating its price.
    if (previousLinkId && previousLinkId !== linkId) await stripe(env, `/v1/payment_links/${encodeURIComponent(previousLinkId)}`, new URLSearchParams({ active: "false" }), `${key}:attempt:${attemptId}:archive:payment_link`);
    if (previousPriceId && previousPriceId !== priceId) await stripe(env, `/v1/prices/${encodeURIComponent(previousPriceId)}`, new URLSearchParams({ active: "false" }), `${key}:attempt:${attemptId}:archive:price`);
    await withWorkerTransaction(app, async (tx) => {
      await projection(tx, productId, "product", productIdExternal, null, "synced", key, null, email, organizationId);
      await projection(tx, productId, "price", priceId, null, "synced", key, null, email, organizationId);
      await projection(tx, productId, "payment_link", linkId || null, linkUrl || null, "synced", key, null, email, organizationId);
    });
    return json({ data: { productId: productIdExternal, priceId, paymentLinkId: linkId || null, paymentLinkUrl: linkUrl || null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "provider_sync_failed";
    // Keep successfully-created Stripe resources available to the retry path:
    // Stripe replays create responses for stable idempotency keys, so disabling
    // them here would make a later successful ledger write point at inactive
    // artifacts. Previous published artifacts are restored if replacement
    // archival had already started.
    if (previousProjections.length) {
      const rollback = await Promise.allSettled([
        withWorkerTransaction(app, async (tx) => {
          for (const row of previousProjections) {
            await tx.query(
              `UPDATE public.catalog_provider_projections
               SET external_id=$3, external_url=$4, sync_state=$5, sync_mode=$6,
                   metadata=$7::jsonb, idempotency_key=$8, last_error=$9,
                   last_error_code=$10, updated_by_email=$11, updated_at=now()
               WHERE medusa_product_id=$1 AND provider='stripe' AND artifact_type=$2
                 AND metadata->>'organization_id'=$12`,
              [productId, row.artifact_type, row.external_id, row.external_url, row.sync_state, row.sync_mode, JSON.stringify(row.metadata ?? {}), row.idempotency_key, row.last_error, row.last_error_code, row.updated_by_email, organizationId],
            );
          }
        }),
        ...previousProjections.filter((row) => row.external_id).map((row) =>
          stripe(
            env,
            "/v1/" + (row.artifact_type === "payment_link" ? "payment_links" : row.artifact_type + "s") + "/" + encodeURIComponent(row.external_id!),
            new URLSearchParams({ active: "true" }),
            `${key}:attempt:${attemptId}:restore:${row.artifact_type}`,
          ),
        ),
      ]);
      if (rollback.some((result) => result.status === "rejected")) {
        return json({ error: "provider_sync_reconciliation_required", code: "PROVIDER_RECONCILIATION_REQUIRED" }, 502);
      }
    } else {
      for (const [artifact, externalId] of [["product", productIdExternal], ["price", priceId], ["payment_link", linkId]] as const) await projection(app, productId, artifact, externalId, null, "failed", key, message, email, organizationId).catch(() => undefined);
    }
    return json({ error: "provider_sync_failed", code: "PROVIDER_SYNC_FAILED" }, 502);
  }
}

export async function handleCatalogProviderSyncRequest(request: Request, app: WorkerDatabaseClient, env: Env, commerce?: WorkerDatabaseClient): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")?.trim() || "";
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.clone().text();
  if (raw.length > 64 * 1024) return json({ error: "payload_too_large" }, 413);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(app),
    key,
    await digest(raw),
    () => performCatalogProviderSyncRequest(request, app, env, commerce),
  );
  return result.response;
}
