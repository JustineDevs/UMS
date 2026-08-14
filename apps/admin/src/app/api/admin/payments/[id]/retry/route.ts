import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson } from "@/lib/staff-api-response";
import { randomUUID } from "crypto";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getRequestHash,
  requireIdempotencyKey,
  stepUpRequired,
} from "@/lib/admin-api-security";
import { tryCreateSupabaseClient } from "@universal-music-store/platform-data";
import { insertStaffAuditLog } from "@/lib/staff-audit";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const correlationId = _req.headers.get("x-request-id")?.trim() || randomUUID();
  const staff = await requireStaffApiSession("orders:write");
  if (!staff.ok) return staff.response;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return correlatedJson(correlationId, { error: "Missing id" }, { status: 400 });
  }
  const idempotencyKey = requireIdempotencyKey(_req);
  if (!idempotencyKey) {
    return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  }
  if (!stepUpRequired("payments.retry", _req)) {
    return correlatedJson(correlationId, { error: "Step-up authentication required" }, { status: 403 });
  }

  const sb = tryCreateSupabaseClient();
  const claim = await claimAdminIdempotency(sb, {
    actorKey: typeof staff.session.user?.email === "string" ? staff.session.user.email : "unknown",
    actionKey: `payments.retry:${id.trim()}`,
    idempotencyKey,
    requestHash: getRequestHash({ id: id.trim() }),
  });
  if (claim.kind === "unavailable") {
    return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  }
  if (claim.kind === "conflict") {
    return correlatedJson(correlationId, { error: "Request is already being processed or key was reused" }, { status: 409 });
  }
  if (claim.kind === "replay") {
    return correlatedJson(correlationId, claim.body, { status: claim.status });
  }

  const origin = process.env.STOREFRONT_ORIGIN?.replace(/\/$/, "").trim();
  const secret = process.env.STOREFRONT_INTERNAL_RECONCILE_SECRET?.trim();
  if (!origin || !secret) {
    return correlatedJson(
      correlationId,
      {
        error:
          "STOREFRONT_ORIGIN and STOREFRONT_INTERNAL_RECONCILE_SECRET must be set for retry finalization.",
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${origin}/api/internal/reconcile-payment-attempt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ correlationId: id.trim() }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const status = res.status >= 400 && res.status < 600 ? res.status : 502;
      const body = {
        error: typeof json.error === "string" ? json.error : "Retry failed",
      };
      await completeAdminIdempotency(sb, claim.id, status, body);
      return correlatedJson(
        correlationId,
        body,
        { status },
      );
    }
    await completeAdminIdempotency(sb, claim.id, 200, json);
    if (sb) await insertStaffAuditLog(sb, {
      actorEmail: typeof staff.session.user?.email === "string" ? staff.session.user.email : "unknown",
      action: "payment.retry",
      resource: "payment_attempt",
      resourceId: id.trim(),
      details: { result: json },
    });
    return correlatedJson(correlationId, json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    const body = { error: msg };
    await completeAdminIdempotency(sb, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }
}
