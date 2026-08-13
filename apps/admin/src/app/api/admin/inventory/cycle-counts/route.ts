import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";
import { fetchVariantStockedQuantity } from "@/lib/medusa-catalog-inventory-stock";

export const dynamic = "force-dynamic";
const lineSchema = z.object({ productId: z.string().trim().min(1).max(200), variantId: z.string().trim().min(1).max(200) }).strict();
const createSchema = z.object({ locationId: z.string().trim().min(1).max(200), lines: z.array(lineSchema).min(1).max(500) }).strict().superRefine((value, ctx) => { if (new Set(value.lines.map((line) => line.variantId)).size !== value.lines.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "A variant may only appear once" }); });

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  const { data, error } = await sup.client.from("inventory_cycle_counts").select("*,inventory_cycle_count_lines(*)").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(limit);
  if (error) return correlatedJson(correlationId, { error: "Unable to load inventory cycle counts", code: "INVENTORY_CYCLE_COUNTS_FAILED" }, { status: 502 });
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
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionKey: "inventory.cycle_count.create", idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Idempotency key was already used with another request" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const expected: Array<{ productId: string; variantId: string; expectedQuantity: number }> = [];
  for (const line of parsed.data.lines) {
    const quantity = await fetchVariantStockedQuantity(line.variantId, parsed.data.locationId);
    if (quantity == null) {
      const body = { error: "Inventory quantity is unavailable", code: "INVENTORY_READ_FAILED" };
      await completeAdminIdempotency(sup.client, claim.id, 502, body);
      return correlatedJson(correlationId, body, { status: 502 });
    }
    expected.push({ ...line, expectedQuantity: quantity });
  }
  const { data: count, error } = await sup.client.from("inventory_cycle_counts").insert({ organization_id: organization.id, location_id: parsed.data.locationId, idempotency_key: idempotencyKey, created_by_email: actor }).select("*").single();
  if (error || !count) {
    const body = { error: "Unable to create inventory cycle count", code: "INVENTORY_CYCLE_COUNT_CREATE_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  const { error: linesError } = await sup.client.from("inventory_cycle_count_lines").insert(expected.map((line) => ({ cycle_count_id: count.id, product_id: line.productId, variant_id: line.variantId, expected_quantity: line.expectedQuantity })));
  if (linesError) {
    const body = { error: "Unable to persist inventory cycle count lines", code: "INVENTORY_CYCLE_COUNT_CREATE_FAILED" };
    await sup.client.from("inventory_cycle_counts").update({ status: "failed", failure_code: body.code, failure_message: body.error, revision: count.revision + 1, updated_at: new Date().toISOString() }).eq("id", count.id).eq("organization_id", organization.id).eq("revision", count.revision);
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  const body = { data: { ...count, inventory_cycle_count_lines: expected.map((line) => ({ ...line, countedQuantity: null })) }, organizationId: organization.id };
  await completeAdminIdempotency(sup.client, claim.id, 201, body);
  return correlatedJson(correlationId, body, { status: 201 });
}
