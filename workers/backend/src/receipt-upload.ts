import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES + 256 * 1024;
const MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
type Env = { JWT_SECRET?: string; SUPABASE_URL?: string; SUPABASE_STORAGE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string; DEFAULT_ORGANIZATION_ID?: string };

function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function signature(mime: string, bytes: Uint8Array): boolean {
  if (mime === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]);
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}
function storageBase(env: Env): string | null { return (env.SUPABASE_STORAGE_URL || env.SUPABASE_URL)?.trim().replace(/\/$/, "") || null; }
async function storage(env: Env, path: string, init: RequestInit): Promise<Response> {
  const base = storageBase(env);
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error("storage_not_configured");
  const headers = new Headers(init.headers); headers.set("Authorization", `Bearer ${key}`); headers.set("apikey", key);
  return fetch(`${base}/storage/v1${path}`, { ...init, headers });
}
async function remove(env: Env, path: string): Promise<void> { try { await storage(env, `/object/payment-receipts/${path}`, { method: "DELETE" }); } catch { /* cleanup is best effort */ } }

export async function handleReceiptUploadRequest(request: Request, app: WorkerDatabaseClient, commerce: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!claims || !claims.sub?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Authentication required" }, 401);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: "Receipt upload is too large" }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "Invalid form data" }, 400); }
  const orderId = typeof form.get("orderId") === "string" ? String(form.get("orderId")).trim() : "";
  if (!orderId || orderId.length > 200) return json({ error: "orderId is required" }, 400);
  const order = await commerce.query<{ id: string }>(`SELECT id FROM public."order" WHERE deleted_at IS NULL AND (id=$1 OR display_id::text=$1) AND lower(email)=$2 LIMIT 1`, [orderId, email]);
  if (!order.rows[0]) return json({ error: "Order not found" }, 404);
  const attempt = await app.query<{ id: string; organization_id: string | null }>(`SELECT id, organization_id FROM public.payment_attempts WHERE medusa_order_id=$1 AND lower(customer_email)=$2 ORDER BY updated_at DESC LIMIT 1`, [order.rows[0].id, email]);
  const organizationId = attempt.rows[0]?.organization_id?.trim() || env.DEFAULT_ORGANIZATION_ID?.trim();
  if (!organizationId) return json({ error: "Store organization is not configured" }, 503);
  const file = form.get("receipt");
  if (!(file instanceof File)) return json({ error: "receipt file is required" }, 400);
  if (file.size > MAX_FILE_BYTES) return json({ error: "File must be under 5 MB" }, 400);
  const mime = file.type || "application/octet-stream";
  if (!MIME.has(mime)) return json({ error: "Only JPEG, PNG, WebP, or PDF files are accepted" }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signature(mime, bytes)) return json({ error: "Receipt contents do not match the declared file type" }, 400);
  const extension = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const fileId = crypto.randomUUID();
  const path = `${order.rows[0].id}/${fileId}.${extension}`;
  const uploaded = await storage(env, `/object/payment-receipts/${path}`, { method: "POST", headers: { "Content-Type": mime, "x-upsert": "false" }, body: bytes });
  if (!uploaded.ok) return json({ error: "Upload failed. Try again." }, 503);
  try {
    const row = await app.query<{ id: string }>(`INSERT INTO public.payment_receipts (order_id,user_id,organization_id,payment_attempt_id,customer_email,storage_path,mime_type,file_size_bytes,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_review') RETURNING id`, [order.rows[0].id, claims.sub.trim(), organizationId, attempt.rows[0]?.id ?? null, email, path, mime, file.size]);
    if (!row.rows[0]) throw new Error("receipt_insert_failed");
    const signed = await storage(env, "/object/sign/payment-receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: [path], expiresIn: 300 }) });
    if (!signed.ok) return json({ ok: true, receiptId: row.rows[0].id, url: null }, 202);
    const payload = await signed.json() as { signedURL?: string; signedUrl?: string; data?: { signedURL?: string } };
    return json({ ok: true, receiptId: row.rows[0].id, url: payload.signedURL || payload.signedUrl || payload.data?.signedURL || null }, payload.signedURL || payload.signedUrl || payload.data?.signedURL ? 200 : 202);
  } catch {
    await remove(env, path);
    return json({ error: "Failed to record receipt. Contact support." }, 503);
  }
}
