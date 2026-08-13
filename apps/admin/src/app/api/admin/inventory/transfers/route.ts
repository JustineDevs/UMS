import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  variantId: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(1_000_000),
}).strict();
const createSchema = z.object({
  sourceLocationId: z.string().trim().min(1).max(200),
  destinationLocationId: z.string().trim().min(1).max(200),
  lines: z.array(lineSchema).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.sourceLocationId === value.destinationLocationId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destinationLocationId"], message: "Locations must differ" });
  }
  if (new Set(value.lines.map((line) => line.variantId)).size !== value.lines.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "A variant may only appear once" });
  }
});

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  const { data, error } = await sup.client.from("inventory_transfers").select("*,inventory_transfer_lines(*)").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(limit);
  if (error) return correlatedJson(correlationId, { error: "Unable to load inventory transfers", code: "INVENTORY_TRANSFERS_FAILED" }, { status: 502 });
  return correlatedJson(correlationId, { data: data ?? [], organizationId: organization.id });
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = await parseAdminJson(request, createSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const actor = staff.session.user?.email?.trim().toLowerCase() ?? "system";
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionKey: "inventory.transfer.create", idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Idempotency key was already used with another request" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const { data: transfer, error } = await sup.client.from("inventory_transfers").insert({ organization_id: organization.id, source_location_id: parsed.data.sourceLocationId, destination_location_id: parsed.data.destinationLocationId, idempotency_key: idempotencyKey, created_by_email: actor }).select("*").single();
  if (error || !transfer) {
    const body = { error: "Unable to create inventory transfer", code: "INVENTORY_TRANSFER_CREATE_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  const { error: linesError } = await sup.client.from("inventory_transfer_lines").insert(parsed.data.lines.map((line) => ({ transfer_id: transfer.id, product_id: line.productId, variant_id: line.variantId, quantity: line.quantity })));
  if (linesError) {
    await sup.client.from("inventory_transfers").update({ status: "failed", failure_code: "LINE_CREATE_FAILED", failure_message: "Unable to persist transfer lines", revision: transfer.revision + 1, updated_at: new Date().toISOString() }).eq("id", transfer.id).eq("organization_id", organization.id).eq("revision", transfer.revision);
    const body = { error: "Unable to create inventory transfer", code: "INVENTORY_TRANSFER_CREATE_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  const body = { data: { ...transfer, inventory_transfer_lines: parsed.data.lines }, organizationId: organization.id };
  await completeAdminIdempotency(sup.client, claim.id, 201, body);
  return correlatedJson(correlationId, body, { status: 201 });
}
