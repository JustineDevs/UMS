import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { resolveWorkerStaffPrincipal, workerStaffHasPermission } from "./staff-principal.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { SUPABASE_URL?: string; fetch?: typeof fetch };
type Note = { id: string; note_body: string; author_email: string | null; created_at: string; is_deleted?: boolean };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16 * 1024;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBoundedText(request: Request): Promise<string | Response> {
  const length = request.headers.get("Content-Length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return json({ error: "payload_too_large" }, 413);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: "payload_too_large" }, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
}

async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function customerEmail(request: Request): string | null {
  const values = new URL(request.url).searchParams.getAll("customer_email");
  if (values.length !== 1) return null;
  const email = values[0].trim().toLowerCase();
  return email.length <= 320 && EMAIL.test(email) ? email : null;
}

function noteDto(row: Note): Record<string, unknown> {
  return {
    id: String(row.id),
    note_body: String(row.note_body),
    author_email: row.author_email == null ? null : String(row.author_email),
    created_at: String(row.created_at),
    ...(row.is_deleted === undefined ? {} : { is_deleted: Boolean(row.is_deleted) }),
  };
}

function idempotencyKey(request: Request): string | null {
  const key = request.headers.get("Idempotency-Key")?.trim();
  return key && key.length >= 8 && key.length <= 200 ? key : null;
}

export async function handleAdminCrmNotesRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: Env,
  noteId?: string,
): Promise<Response> {
  if (!["GET", "POST", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const principal = await resolveWorkerStaffPrincipal(request, database, env);
  if (principal instanceof Response) return principal;
  const permission = request.method === "GET" ? "crm:read" : "crm:write";
  if (!workerStaffHasPermission(principal, permission)) return json({ error: "forbidden" }, 403);

  if (request.method === "GET" || request.method === "POST") {
    const email = customerEmail(request);
    if (!email) return json({ error: "invalid_customer_email" }, 400);
    if (request.method === "GET") {
      const result = await database.query<Note>(
        "SELECT id,note_body,author_email,created_at,is_deleted FROM public.staff_customer_notes WHERE customer_email=$1 AND organization_id=$2 AND is_deleted=false ORDER BY created_at DESC LIMIT 100",
        [email, principal.organizationId],
      );
      return json({ data: result.rows.map(noteDto) });
    }

    const key = idempotencyKey(request);
    if (!key) return json({ error: "invalid_idempotency_key" }, 400);
    const raw = await readBoundedText(request);
    if (raw instanceof Response) return raw;
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "invalid_note" }, 400);
    const fields = input as Record<string, unknown>;
    if (Object.keys(fields).some((field) => field !== "note_body")) return json({ error: "unknown_request_field" }, 400);
    const note = typeof fields.note_body === "string" ? fields.note_body.trim() : "";
    if (!note || [...note].length > 4000) return json({ error: "invalid_note" }, 400);

    const requestHash = await digest({ method: request.method, email, note });
    const scopedKey = `crm-note:${principal.organizationId}:${principal.userId}:${key}`;
    return withWorkerTransaction(database, async (tx) => (await executeIdempotently(
      new HyperdriveIdempotencyStore(tx),
      scopedKey,
      requestHash,
      async () => {
        const inserted = await tx.query<Note>(
          "INSERT INTO public.staff_customer_notes (organization_id,customer_email,note_body,author_email) VALUES ($1,$2,$3,$4) RETURNING id,note_body,author_email,created_at",
          [principal.organizationId, email, note, principal.email],
        );
        const row = inserted.rows[0];
        if (!row) return json({ error: "note_unavailable" }, 503);
        await tx.query(
          "INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)",
          ["crm.note.create", `customer:${email}`, JSON.stringify({ organization_id: principal.organizationId, note_id: row.id, actor_user_id: principal.userId, actor_email: principal.email })],
        );
        return json({ data: noteDto(row) }, 201);
      },
    )).response);
  }

  if (!noteId || !UUID.test(noteId)) return json({ error: "invalid_note_id" }, 400);
  const key = idempotencyKey(request);
  if (!key) return json({ error: "invalid_idempotency_key" }, 400);
  const requestHash = await digest({ method: request.method, noteId });
  const scopedKey = `crm-note-delete:${principal.organizationId}:${principal.userId}:${key}`;
  return withWorkerTransaction(database, async (tx) => (await executeIdempotently(
    new HyperdriveIdempotencyStore(tx),
    scopedKey,
    requestHash,
    async () => {
      const result = await tx.query<{ customer_email: string }>(
        "UPDATE public.staff_customer_notes SET is_deleted=true WHERE id=$1 AND organization_id=$2 AND is_deleted=false RETURNING customer_email",
        [noteId, principal.organizationId],
      );
      if (!result.rows[0]) return json({ error: "note_not_found" }, 404);
      await tx.query(
        "INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)",
        ["crm.note.delete", `customer:${result.rows[0].customer_email}`, JSON.stringify({ organization_id: principal.organizationId, note_id: noteId, actor_user_id: principal.userId, actor_email: principal.email })],
      );
      return json({ ok: true });
    },
  )).response);
}
