import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type InvoiceAdminEnv = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; RESEND_FROM?: string };
type InvoiceAction = "retry" | "void" | "refund";

const SELECT_FIELDS =
  "id,reference_number,status,currency,total,recipient_email,sent_at,created_by,created_at,updated_at,document_kind,fiscal_status,fiscal_number,medusa_order_id,refund_id";
const ACTIONS: Record<InvoiceAction, { event: InvoiceAction; status: string }> = {
  retry: { event: "retry", status: "retryable" },
  void: { event: "void", status: "voided" },
  refund: { event: "refund", status: "refunded" },
};

function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function organization(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasPermission(claims: WorkerAuthClaims, permission: string): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === permission);
}

async function authenticate(request: Request, env: InvoiceAdminEnv, permission: string): Promise<{ claims: WorkerAuthClaims } | Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.CMS_ADMIN_JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!hasPermission(claims, permission)) return json({ error: "forbidden" }, 403);
  if (!organization(claims)) return json({ error: "organization_claim_required" }, 403);
  return { claims };
}

function idempotencyKey(request: Request): string | null {
  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  return key && key.length <= 255 ? key : null;
}

async function requestHash(request: Request, body: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ path: new URL(request.url).pathname, body }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function validEmail(value: unknown): string | null {
  const text = boundedText(value, 320)?.toLowerCase() ?? null;
  return text && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? text : null;
}

function normalizeInvoice(value: unknown): { invoice: Record<string, unknown>; documentKind: string; fiscalNumber: string | null; mode: "draft" | "send"; total: number; recipientId: string; recipientEmail: string; medusaOrderId: string | null; refundId: string | null } | { error: string } {
  if (!value || typeof value !== "object") return { error: "invalid_json" };
  const input = value as Record<string, unknown>;
  const invoice = input.invoice;
  if (!invoice || typeof invoice !== "object") return { error: "invoice_required" };
  const source = invoice as Record<string, unknown>;
  const referenceNumber = boundedText(source.referenceNumber, 80);
  const recipient = source.to;
  if (!referenceNumber || !recipient || typeof recipient !== "object") return { error: "invalid_invoice" };
  const recipientSource = recipient as Record<string, unknown>;
  const recipientId = boundedText(recipientSource.id, 80);
  const recipientEmail = validEmail(recipientSource.email);
  if (!recipientId || !recipientEmail) return { error: "invalid_recipient" };
  const documentKind = input.documentKind === undefined ? "admin_artifact" : boundedText(input.documentKind, 32);
  if (!documentKind || !["admin_artifact", "commercial_invoice", "fiscal_invoice"].includes(documentKind)) return { error: "invalid_document_kind" };
  const fiscalNumber = input.fiscalNumber === undefined ? null : boundedText(input.fiscalNumber, 80);
  if (documentKind === "fiscal_invoice" && !fiscalNumber) return { error: "fiscal_number_required" };
  if (documentKind !== "fiscal_invoice" && fiscalNumber) return { error: "fiscal_number_not_allowed" };
  const mode = input.mode === undefined ? "draft" : input.mode;
  if (mode !== "draft" && mode !== "send") return { error: "invalid_mode" };
  const items = source.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) return { error: "invalid_items" };
  let subtotal = 0;
  for (const value of items) {
    if (!value || typeof value !== "object") return { error: "invalid_item" };
    const item = value as Record<string, unknown>;
    const description = boundedText(item.description, 240);
    const quantity = item.quantity;
    const unitPrice = item.unitPrice;
    if (!description || !Number.isSafeInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10000 || typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) return { error: "invalid_item" };
    subtotal += (quantity as number) * unitPrice;
  }
  const discountType = source.discountType === undefined ? "fixed" : source.discountType;
  const discountValue = source.discountValue === undefined ? 0 : source.discountValue;
  const taxRate = source.taxRate === undefined ? 0 : source.taxRate;
  if ((discountType !== "fixed" && discountType !== "percent") || typeof discountValue !== "number" || !Number.isFinite(discountValue) || discountValue < 0 || (discountType === "percent" && discountValue > 100) || typeof taxRate !== "number" || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { error: "invalid_totals" };
  const discount = discountType === "percent" ? subtotal * (discountValue as number) / 100 : discountValue as number;
  const taxable = Math.max(0, subtotal - Math.min(discount, subtotal));
  const total = Number((taxable + taxable * (taxRate as number) / 100).toFixed(2));
  return { invoice: { ...source, referenceNumber, discountType, discountValue, taxRate }, documentKind, fiscalNumber, mode, total, recipientId, recipientEmail, medusaOrderId: boundedText(input.medusaOrderId, 255), refundId: boundedText(input.refundId, 255) };
}

function invoiceHtml(invoice: Record<string, unknown>, total: number): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
  const rows = (Array.isArray(invoice.items) ? invoice.items : []).map((value) => {
    const item = value as Record<string, unknown>;
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    return `<tr><td>${escape(String(item.description ?? ""))}</td><td>${quantity}</td><td>PHP ${unitPrice.toFixed(2)}</td><td>PHP ${(quantity * unitPrice).toFixed(2)}</td></tr>`;
  }).join("");
  return `<h1>Invoice ${escape(String(invoice.referenceNumber ?? ""))}</h1><table><tbody>${rows}</tbody></table><p><strong>Total: PHP ${total.toFixed(2)}</strong></p>`;
}

export async function handleInvoiceCreateRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  medusaDatabase: WorkerDatabaseClient,
  env: InvoiceAdminEnv,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await authenticate(request, env, "receipts:send");
  if (auth instanceof Response) return auth;
  const key = idempotencyKey(request);
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  let parsed: unknown;
  try { parsed = JSON.parse(await request.text()); } catch { return json({ error: "invalid_json" }, 400); }
  const normalized = normalizeInvoice(parsed);
  if ("error" in normalized) return json({ error: normalized.error }, 400);
  const org = organization(auth.claims)!;
  const customer = await medusaDatabase.query<{ id: string; email: string; first_name: string | null; last_name: string | null }>("SELECT id,email,first_name,last_name FROM public.customer WHERE id = $1 AND deleted_at IS NULL LIMIT 1", [normalized.recipientId]);
  const canonical = customer.rows[0];
  if (!canonical?.email) return json({ error: "invoice_recipient_unavailable" }, 404);
  if (canonical.email.trim().toLowerCase() !== normalized.recipientEmail) return json({ error: "invoice_recipient_changed" }, 409);
  const hash = await requestHash(request, parsed);
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(appDatabase), key, hash, async () => {
    const canonicalName = [canonical.first_name, canonical.last_name].filter(Boolean).join(" ").trim() || canonical.email;
    const payload = { ...normalized.invoice, to: { ...(normalized.invoice.to as Record<string, unknown>), id: canonical.id, name: canonicalName, email: canonical.email } };
    const inserted = await appDatabase.query<Record<string, unknown>>(`INSERT INTO public.admin_invoices (organization_id,reference_number,status,currency,total,recipient_email,payload,document_kind,fiscal_status,fiscal_number,medusa_order_id,refund_id,created_by) VALUES ($1,$2,'draft','PHP',$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11) RETURNING ${SELECT_FIELDS}`, [org, normalized.invoice.referenceNumber, normalized.total, canonical.email, JSON.stringify(payload), normalized.documentKind, normalized.documentKind === "fiscal_invoice" ? "draft" : "non_fiscal", normalized.fiscalNumber, normalized.medusaOrderId, normalized.refundId, boundedText(auth.claims.email, 320) ?? "worker-admin"]);
    const invoice = inserted.rows[0];
    if (!invoice) return json({ error: "invoice_create_failed" }, 502);
    const fiscalDraft = normalized.documentKind === "fiscal_invoice" ? "draft" : "non_fiscal";
    await appDatabase.query("SELECT public.record_invoice_lifecycle($1,$2::uuid,'create','draft',$3,$4,NULL,'{}'::jsonb)", [org, invoice.id, fiscalDraft, `${key}:create`]);
    if (normalized.mode === "draft") return json({ data: invoice }, 201);
    if (!env.RESEND_API_KEY?.trim()) {
      await appDatabase.query("SELECT public.record_invoice_lifecycle($1,$2::uuid,'fail','failed',$3,$4,$5,'{}'::jsonb)", [org, invoice.id, fiscalDraft, `${key}:failed`, "RESEND_API_KEY is not configured"]);
      return json({ error: "invoice_saved_as_draft_email_not_configured", data: invoice }, 503);
    }
    await appDatabase.query("SELECT public.record_invoice_lifecycle($1,$2::uuid,'send','sending',$3,$4,NULL,'{}'::jsonb)", [org, invoice.id, fiscalDraft, `${key}:sending`]);
    const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL?.trim() || env.RESEND_FROM?.trim() || "noreply@universal-music-store.com", to: [canonical.email], subject: `Invoice ${normalized.invoice.referenceNumber}`, html: invoiceHtml(normalized.invoice, normalized.total), tags: [{ name: "type", value: "admin_invoice" }] }) });
    if (!sent.ok) {
      await appDatabase.query("SELECT public.record_invoice_lifecycle($1,$2::uuid,'fail','failed',$3,$4,$5,'{}'::jsonb)", [org, invoice.id, fiscalDraft, `${key}:failed`, "Invoice email delivery failed"]);
      return json({ error: "invoice_saved_as_draft_email_failed", data: invoice }, 502);
    }
    const lifecycle = await appDatabase.query<Record<string, unknown>>("SELECT public.record_invoice_lifecycle($1,$2::uuid,'send','sent',$3,$4,NULL,'{}'::jsonb) AS value", [org, invoice.id, normalized.documentKind === "fiscal_invoice" ? "issued" : "non_fiscal", `${key}:sent`]);
    await appDatabase.query("UPDATE public.admin_invoices SET sent_at=now() WHERE id=$1 AND organization_id=$2", [invoice.id, org]);
    return json({ data: lifecycle.rows[0]?.value ?? invoice });
  });
  return result.response;
}

export async function handleInvoiceListRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: InvoiceAdminEnv,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const auth = await authenticate(request, env, "receipts:read");
  if (auth instanceof Response) return auth;
  const org = organization(auth.claims)!;
  const result = await database.query(
    `SELECT ${SELECT_FIELDS} FROM public.admin_invoices
     WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [org],
  );
  return json({ data: result.rows });
}

export async function handleInvoiceLifecycleRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: InvoiceAdminEnv,
  invoiceId: string,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await authenticate(request, env, "receipts:send");
  if (auth instanceof Response) return auth;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invoiceId)) return json({ error: "invalid_invoice_id" }, 400);
  const key = idempotencyKey(request);
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  let input: { action?: unknown };
  try { input = JSON.parse(raw) as { action?: unknown }; } catch { return json({ error: "invalid_json" }, 400); }
  const action = input.action;
  if (action !== "retry" && action !== "void" && action !== "refund") return json({ error: "invalid_action" }, 400);
  const org = organization(auth.claims)!;
  const target = ACTIONS[action];
  const hash = await requestHash(request, { invoiceId, action });
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(database), key, hash, async () => {
    const invoice = await database.query<{ id: string; status: string; fiscal_status: string; document_kind: string }>(
      `SELECT id,status,fiscal_status,document_kind FROM public.admin_invoices WHERE id = $1 AND organization_id = $2`,
      [invoiceId, org],
    );
    const current = invoice.rows[0];
    if (!current) return json({ error: "invoice_not_found" }, 404);
    const fiscalStatus = action === "void" && current.fiscal_status !== "non_fiscal" ? "voided" : current.fiscal_status;
    const lifecycle = await database.query<{ record_invoice_lifecycle: Record<string, unknown> }>(
      `SELECT public.record_invoice_lifecycle($1, $2::uuid, $3, $4, $5, $6, NULL, '{}'::jsonb) AS record_invoice_lifecycle`,
      [org, invoiceId, target.event, target.status, fiscalStatus, key],
    );
    const row = lifecycle.rows[0]?.record_invoice_lifecycle;
    return row ? json({ data: row }) : json({ error: "invoice_lifecycle_failed" }, 502);
  });
  return result.response;
}
