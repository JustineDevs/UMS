import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z, type ZodType } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_DEFAULT_BODY_BYTES = 1_048_576;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export const adminJsonObjectSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx) => {
    if (containsDangerousKey(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid object keys" });
    }
  });

export type AdminJsonParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: string };

export async function parseAdminJson<T>(
  request: Request,
  schema: ZodType<T> = adminJsonObjectSchema as ZodType<T>,
  maxBytes = MAX_DEFAULT_BODY_BYTES,
): Promise<AdminJsonParseResult<T>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body too large" };
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType && contentType !== "application/json") {
    return { ok: false, status: 400, error: "Content-Type must be application/json" };
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body too large" };
  }
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
  if (containsDangerousKey(value)) {
    return { ok: false, status: 400, error: "Invalid request" };
  }
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, status: 400, error: "Invalid request" };
}

export function containsDangerousKey(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsDangerousKey(item, seen));
  return Object.entries(value).some(
    ([key, nested]) => DANGEROUS_KEYS.has(key) || containsDangerousKey(nested, seen),
  );
}

export function getRequestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && /^[A-Za-z0-9._:-]{8,200}$/.test(key) ? key : null;
}

export function requireIdempotencyKey(request: Request): string | null {
  return getIdempotencyKey(request);
}

export type AdminIdempotencyClaim =
  | { kind: "claimed"; id: string }
  | { kind: "replay"; status: number; body: Record<string, unknown> }
  | { kind: "conflict" }
  | { kind: "unavailable" };

export async function claimAdminIdempotency(
  client: SupabaseClient | null,
  input: {
    actorKey: string;
    actionKey: string;
    idempotencyKey: string;
    requestHash: string;
  },
): Promise<AdminIdempotencyClaim> {
  if (!client) return { kind: "unavailable" };

  const existing = await client
    .from("admin_api_idempotency")
    .select("id, request_hash, status, response_status, response_body, expires_at")
    .eq("actor_key", input.actorKey)
    .eq("action_key", input.actionKey)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") return { kind: "unavailable" };

  if (existing.data && new Date(existing.data.expires_at).getTime() > Date.now()) {
    if (existing.data.request_hash !== input.requestHash) return { kind: "conflict" };
    if (
      existing.data.status === "completed" ||
      existing.data.status === "failed"
    ) {
      return {
        kind: "replay",
        status: Number(existing.data.response_status) || 500,
        body:
          existing.data.response_body && typeof existing.data.response_body === "object"
            ? (existing.data.response_body as Record<string, unknown>)
            : { error: "The previous request did not complete." },
      };
    }
    return { kind: "conflict" };
  }

  if (existing.data) {
    await client.from("admin_api_idempotency").delete().eq("id", existing.data.id);
  }

  const inserted = await client
    .from("admin_api_idempotency")
    .insert({
      actor_key: input.actorKey,
      action_key: input.actionKey,
      idempotency_key: input.idempotencyKey,
      request_hash: input.requestHash,
    })
    .select("id")
    .single();
  if (inserted.data?.id) return { kind: "claimed", id: inserted.data.id };

  // Another request may have won the unique insert race. Re-read it and apply
  // the same replay/conflict rules instead of executing the side effect twice.
  const raced = await client
    .from("admin_api_idempotency")
    .select("id, request_hash, status, response_status, response_body")
    .eq("actor_key", input.actorKey)
    .eq("action_key", input.actionKey)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (!raced.data || raced.data.request_hash !== input.requestHash) return { kind: "conflict" };
  if (raced.data.status === "completed" || raced.data.status === "failed") {
    return {
      kind: "replay",
      status: Number(raced.data.response_status) || 500,
      body:
        raced.data.response_body && typeof raced.data.response_body === "object"
          ? (raced.data.response_body as Record<string, unknown>)
          : { error: "The previous request did not complete." },
    };
  }
  return { kind: "conflict" };
}

export async function completeAdminIdempotency(
  client: SupabaseClient | null,
  id: string | null,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  if (!client || !id) return;
  await client
    .from("admin_api_idempotency")
    .update({
      status: status >= 200 && status < 300 ? "completed" : "failed",
      response_status: status,
      response_body: body,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export function verifySignedRequest(
  rawBody: string,
  secret: string,
  signature: string,
  timestamp: string,
  maxSkewSeconds = 300,
): boolean {
  const epoch = Number(timestamp);
  if (!Number.isInteger(epoch) || Math.abs(Date.now() / 1000 - epoch) > maxSkewSeconds) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const actual = signature.trim().replace(/^sha256=/i, "");
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminStepUp(action: string, assertion: string | null): boolean {
  const secret = process.env.ADMIN_STEP_UP_SECRET?.trim();
  if (!secret || !assertion) return false;
  const match = /^(.+)\.(\d+)\.([a-f0-9]+)$/.exec(assertion);
  if (!match) return false;
  const [, assertedAction, expiresRaw, signature] = match;
  const expires = Number(expiresRaw);
  if (assertedAction !== action || !Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", secret).update(`${action}.${expires}`).digest("hex");
  const a = Buffer.from(signature ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function stepUpRequired(action: string, request: Request): boolean {
  if (process.env.ADMIN_STEP_UP_REQUIRED !== "true") return true;
  return verifyAdminStepUp(action, request.headers.get("x-admin-step-up"));
}

export async function verifyDeviceBinding(
  client: SupabaseClient,
  request: Request,
  deviceId: string,
): Promise<boolean> {
  const token = request.headers.get("x-device-token")?.trim();
  if (!token) return false;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await client
    .from("pos_device_bindings")
    .select("id, bound_ip")
    .eq("device_id", deviceId)
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return false;
  const sourceIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return !data.bound_ip || data.bound_ip === sourceIp;
}
