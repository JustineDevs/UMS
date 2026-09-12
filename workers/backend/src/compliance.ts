import {
  withWorkerDatabase,
  withWorkerTransaction,
  type WorkerDatabaseClient,
  type WorkerDatabaseEnv,
} from "./database.ts";

export type ComplianceEnv = WorkerDatabaseEnv & {
  INTERNAL_API_KEY?: string;
  DATA_RETENTION_DAYS?: string;
  DEFAULT_ORGANIZATION_ID?: string;
  /** Test-only seam; runtime bindings always use createWorkerDatabaseClient. */
  databaseFactory?: (role: "app" | "medusa") => WorkerDatabaseClient;
};

async function configuredRetentionDays(env: ComplianceEnv): Promise<number> {
  const fallback = Number.parseInt(env.DATA_RETENTION_DAYS ?? "730", 10);
  const organizationId = env.DEFAULT_ORGANIZATION_ID?.trim();
  if (!organizationId) return Number.isInteger(fallback) && fallback > 0 ? fallback : 730;
  try {
    return await withComplianceDatabase(env, "app", async (database) => {
      const result = await database.query<{ payload?: { retentionDays?: unknown } }>(
        `SELECT payload FROM public.platform_runtime_settings WHERE organization_id = $1 LIMIT 1`,
        [organizationId],
      );
      const value = result.rows[0]?.payload?.retentionDays;
      return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3650 ? value : fallback;
    });
  } catch {
    return Number.isInteger(fallback) && fallback > 0 ? fallback : 730;
  }
}

type QueryRow = Record<string, unknown>;

async function withComplianceDatabase<T>(
  env: ComplianceEnv,
  role: "app" | "medusa",
  operation: (database: WorkerDatabaseClient) => Promise<T>,
): Promise<T> {
  if (!env.databaseFactory) return withWorkerDatabase(env, operation, role);
  const database = env.databaseFactory(role);
  try {
    return await operation(database);
  } finally {
    await database.end();
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function secureEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a[index] ^ b[index];
  return result === 0;
}

function authorized(request: Request, env: ComplianceEnv): boolean {
  const configured = env.INTERNAL_API_KEY?.trim();
  const supplied = request.headers.get("X-Internal-API-Key")?.trim();
  return Boolean(configured && supplied && secureEqual(supplied, configured));
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ? email
    : null;
}

async function readEmail(request: Request): Promise<string | null> {
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeEmail((parsed as Record<string, unknown>).email);
  } catch {
    return null;
  }
}

function queryEmail(request: Request): string | null {
  return normalizeEmail(new URL(request.url).searchParams.get("email"));
}

async function appExport(
  database: WorkerDatabaseClient,
  email: string,
): Promise<{ subject: QueryRow | null; data: Record<string, unknown[]> }> {
  const user = await database.query<QueryRow>(
    `SELECT row_to_json(u) AS value FROM public.users u WHERE lower(u.email) = $1 LIMIT 1`,
    [email],
  );
  const profile = await database.query<QueryRow>(
    `SELECT row_to_json(p) AS value FROM public.storefront_customer_profiles p WHERE lower(p.email) = $1 LIMIT 1`,
    [email],
  );
  const loyalty = await database.query<QueryRow>(
    `SELECT row_to_json(l) AS value FROM public.loyalty_accounts l WHERE lower(l.customer_email) = $1`,
    [email],
  );
  const customerId =
    (profile.rows[0]?.value as QueryRow | null)?.medusa_customer_id ??
    (loyalty.rows[0]?.value as QueryRow | null)?.medusa_customer_id ??
    null;
  const wishlist = customerId
    ? await database.query<QueryRow>(
        `SELECT row_to_json(w) AS value FROM public.wishlists w WHERE w.medusa_customer_id = $1`,
        [customerId],
      )
    : { rows: [] as QueryRow[] };
  const [marketing, newsletter, backInStock, delivery] = await Promise.all([
    database.query<QueryRow>(
      `SELECT row_to_json(m) AS value FROM public.marketing_preferences m WHERE lower(m.email) = $1`,
      [email],
    ),
    database.query<QueryRow>(
      `SELECT row_to_json(n) AS value FROM public.newsletter_confirmations n WHERE lower(n.email) = $1`,
      [email],
    ),
    database.query<QueryRow>(
      `SELECT row_to_json(b) AS value FROM public.back_in_stock_notifications b WHERE lower(b.email) = $1`,
      [email],
    ),
    database.query<QueryRow>(
      `SELECT row_to_json(d) AS value FROM public.public_delivery_attempts d WHERE lower(d.recipient) = $1`,
      [email],
    ),
  ]);
  const subject = (user.rows[0]?.value ?? profile.rows[0]?.value ?? null) as QueryRow | null;
  return {
    subject,
    data: {
      users: user.rows.map((row) => row.value),
      storefront_customer_profiles: profile.rows.map((row) => row.value),
      loyalty_accounts: loyalty.rows.map((row) => row.value),
      wishlists: wishlist.rows.map((row) => row.value),
      marketing_preferences: marketing.rows.map((row) => row.value),
      newsletter_confirmations: newsletter.rows.map((row) => row.value),
      back_in_stock_notifications: backInStock.rows.map((row) => row.value),
      public_delivery_attempts: delivery.rows.map((row) => row.value),
    },
  };
}

async function medusaExport(
  database: WorkerDatabaseClient,
  email: string,
): Promise<{ customer: QueryRow | null; orders: unknown[]; orderItems: unknown[]; addresses: unknown[]; payments: unknown[] }> {
  const customer = await database.query<QueryRow>(
    `SELECT row_to_json(c) AS value FROM public.customer c WHERE lower(c.email) = $1 AND c.deleted_at IS NULL LIMIT 1`,
    [email],
  );
  const customerId = (customer.rows[0]?.value as QueryRow | undefined)?.id;
  if (typeof customerId !== "string") {
    return { customer: null, orders: [], orderItems: [], addresses: [], payments: [] };
  }
  const orders = await database.query<QueryRow>(
    `SELECT row_to_json(o) AS value FROM public."order" o WHERE o.customer_id = $1 AND o.deleted_at IS NULL ORDER BY o.created_at DESC`,
    [customerId],
  );
  const orderIds = orders.rows
    .map((row) => (row.value as QueryRow | undefined)?.id)
    .filter((id): id is string => typeof id === "string");
  const orderItems = orderIds.length
    ? await database.query<QueryRow>(
        `SELECT row_to_json(oi) AS value FROM public.order_item oi WHERE oi.order_id = ANY($1::text[]) AND oi.deleted_at IS NULL`,
        [orderIds],
      )
    : { rows: [] as QueryRow[] };
  const addresses = await database.query<QueryRow>(
    `SELECT row_to_json(a) AS value FROM public.customer_address a WHERE a.customer_id = $1 AND a.deleted_at IS NULL`,
    [customerId],
  );
  const payments = orderIds.length
    ? await database.query<QueryRow>(
        `SELECT row_to_json(pc) AS value FROM public.payment_collection pc JOIN public.order_payment_collection opc ON opc.payment_collection_id = pc.id WHERE opc.order_id = ANY($1::text[]) AND pc.deleted_at IS NULL`,
        [orderIds],
      )
    : { rows: [] as QueryRow[] };
  return {
    customer: customer.rows[0]?.value as QueryRow ?? null,
    orders: orders.rows.map((row) => row.value),
    orderItems: orderItems.rows.map((row) => row.value),
    addresses: addresses.rows.map((row) => row.value),
    payments: payments.rows.map((row) => row.value),
  };
}

async function writeComplianceRequest(
  database: WorkerDatabaseClient,
  type: "dsar_export" | "anonymization" | "retention",
  email: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await database.query(
    `INSERT INTO public.compliance_requests (type, requestor_email, status, metadata) VALUES ($1, $2, 'completed', $3::jsonb)`,
    [type, email, JSON.stringify(metadata)],
  );
}

async function eraseAppData(database: WorkerDatabaseClient, email: string): Promise<string[]> {
  return withWorkerTransaction(database, async (tx) => {
    const profile = await tx.query<QueryRow>(
      `SELECT medusa_customer_id FROM public.storefront_customer_profiles WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    const loyalty = await tx.query<QueryRow>(
      `SELECT medusa_customer_id FROM public.loyalty_accounts WHERE lower(customer_email) = $1 LIMIT 1`,
      [email],
    );
    const customerId = profile.rows[0]?.medusa_customer_id ?? loyalty.rows[0]?.medusa_customer_id;
    const deleted: string[] = [];
    for (const table of ["marketing_preferences", "newsletter_confirmations", "back_in_stock_notifications"]) {
      await tx.query(`DELETE FROM public.${table} WHERE lower(email) = $1`, [email]);
      deleted.push(table);
    }
    await tx.query(`DELETE FROM public.public_delivery_attempts WHERE lower(recipient) = $1`, [email]);
    deleted.push("public_delivery_attempts");
    await tx.query(`DELETE FROM public.wishlists WHERE medusa_customer_id = $1`, [customerId ?? "__missing__"]);
    deleted.push("wishlists");
    await tx.query(`DELETE FROM public.loyalty_accounts WHERE lower(customer_email) = $1`, [email]);
    deleted.push("loyalty_accounts");
    await tx.query(`DELETE FROM public.storefront_customer_profiles WHERE lower(email) = $1`, [email]);
    deleted.push("storefront_customer_profiles");
    await tx.query(`DELETE FROM public.users WHERE lower(email) = $1`, [email]);
    deleted.push("users");
    return deleted;
  });
}

async function anonymizeMedusaCustomer(database: WorkerDatabaseClient, email: string): Promise<boolean> {
  return withWorkerTransaction(database, async (tx) => {
    const customer = await tx.query<QueryRow>(
      `SELECT id FROM public.customer WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
      [email],
    );
    const id = customer.rows[0]?.id;
    if (typeof id !== "string") return false;
    await tx.query(
      `UPDATE public.customer SET email = $2, first_name = 'REDACTED', last_name = 'REDACTED', phone = NULL, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb, updated_at = now() WHERE id = $1`,
      [id, `erased-${id}@redacted.local`, JSON.stringify({ privacy_erased_at: new Date().toISOString() })],
    );
    await tx.query(`DELETE FROM public.customer_address WHERE customer_id = $1`, [id]);
    return true;
  });
}

async function retention(database: WorkerDatabaseClient, days: number): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return withWorkerTransaction(database, async (tx) => {
    const profile = await tx.query(
      `UPDATE public.storefront_customer_profiles SET phone = 'ANONYMIZED' WHERE updated_at < $1 AND phone IS DISTINCT FROM 'ANONYMIZED'`,
      [cutoff],
    );
    const loyalty = await tx.query(
      `UPDATE public.loyalty_accounts SET customer_email = 'ANONYMIZED' WHERE updated_at < $1 AND points_balance = 0 AND customer_email IS DISTINCT FROM 'ANONYMIZED'`,
      [cutoff],
    );
    const newsletter = await tx.query(
      `DELETE FROM public.newsletter_confirmations WHERE created_at < $1`,
      [new Date(Date.now() - 30 * 86_400_000).toISOString()],
    );
    const backInStock = await tx.query(
      `DELETE FROM public.back_in_stock_notifications WHERE created_at < $1`,
      [new Date(Date.now() - 365 * 86_400_000).toISOString()],
    );
    const delivery = await tx.query(
      `DELETE FROM public.public_delivery_attempts WHERE created_at < $1`,
      [new Date(Date.now() - 730 * 86_400_000).toISOString()],
    );
    return {
      addressesUpdated: (profile.rowCount ?? 0) + (loyalty.rowCount ?? 0),
      newsletterConfirmations: newsletter.rowCount ?? 0,
      backInStockNotifications: backInStock.rowCount ?? 0,
      deliveryAttempts: delivery.rowCount ?? 0,
    };
  });
}

const appExportForEmail = (email: string) => (database: WorkerDatabaseClient) => appExport(database, email);
const medusaExportForEmail = (email: string) => (database: WorkerDatabaseClient) => medusaExport(database, email);
const eraseAppDataForEmail = (email: string) => (database: WorkerDatabaseClient) => eraseAppData(database, email);
const anonymizeMedusaCustomerForEmail = (email: string) => (database: WorkerDatabaseClient) => anonymizeMedusaCustomer(database, email);

export async function handleComplianceRequest(
  request: Request,
  env: ComplianceEnv,
): Promise<Response> {
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/compliance/export") {
    const email = queryEmail(request);
    if (!email) return json({ error: "valid_email_required", code: "MISSING_EMAIL" }, 400);
    const [app, medusa] = await Promise.all([
      withComplianceDatabase(env, "app", appExportForEmail(email)),
      withComplianceDatabase(env, "medusa", medusaExportForEmail(email)),
    ]);
    if (!app.subject && !medusa.customer) return json({ error: "subject_not_found", code: "NOT_FOUND" }, 404);
    await withComplianceDatabase(env, "app", (database) => writeComplianceRequest(database, "dsar_export", email, { medusaOrderCount: medusa.orders.length }));
    return json({
      email,
      exportedAt: new Date().toISOString(),
      app: app.data,
      medusa: { customer: medusa.customer, orders: medusa.orders, orderItems: medusa.orderItems, addresses: medusa.addresses, payments: medusa.payments },
    });
  }
  if (request.method === "POST" && path === "/compliance/erasure") {
    const email = await readEmail(request);
    if (!email) return json({ error: "valid_email_required", code: "MISSING_EMAIL" }, 400);
    const [deletedApp, anonymizedMedusa] = await Promise.all([
      withComplianceDatabase(env, "app", eraseAppDataForEmail(email)),
      withComplianceDatabase(env, "medusa", anonymizeMedusaCustomerForEmail(email)),
    ]);
    await withComplianceDatabase(env, "app", (database) => writeComplianceRequest(database, "anonymization", email, { anonymizedMedusa }));
    return json({ ok: true, email, app: { deleted: deletedApp }, medusa: { customerAnonymized: anonymizedMedusa } });
  }
  if (request.method === "POST" && path === "/compliance/retention/anonymize-addresses") {
    let body: unknown = {};
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const rawDays = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).days : undefined;
    const configured = await configuredRetentionDays(env);
    const days = typeof rawDays === "number" ? rawDays : Number.parseInt(String(rawDays ?? configured), 10);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return json({ error: "invalid_retention_days" }, 400);
    const result = await withComplianceDatabase(env, "app", (database) => retention(database, days));
    await withComplianceDatabase(env, "app", (database) => writeComplianceRequest(database, "retention", "system", { days, ...result }));
    return json({ ...result, cutoff: new Date(Date.now() - days * 86_400_000).toISOString(), days });
  }
  return json({ error: "not_found" }, 404);
}
