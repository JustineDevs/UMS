import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";
import { applyInventoryStockChanges, type InventoryStockChange } from "@/lib/inventory-lifecycle";
import { fetchVariantStockedQuantity } from "@/lib/medusa-catalog-inventory-stock";
import { insertStaffAuditLog } from "@/lib/staff-audit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  action: z.enum(["record", "complete", "cancel"]),
  expectedRevision: z.number().int().positive(),
  lines: z.array(z.object({ lineId: z.string().uuid(), countedQuantity: z.number().int().nonnegative().max(1_000_000) }).strict()).max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === "record" && (!value.lines || value.lines.length === 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Counted lines are required" });
  if (value.lines && new Set(value.lines.map((line) => line.lineId)).size !== value.lines.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "A line may only be recorded once" });
});

export async function GET(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const { id } = await context.params;
  const result = await sup.client.from("inventory_cycle_counts").select("*,inventory_cycle_count_lines(*)").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (result.error) return correlatedJson(correlationId, { error: "Unable to load inventory cycle count" }, { status: 502 });
  if (!result.data) return correlatedJson(correlationId, { error: "Inventory cycle count not found" }, { status: 404 });
  return correlatedJson(correlationId, { data: result.data });
}

export async function POST(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = await parseAdminJson(request, bodySchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const { id } = await context.params;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const actor = staff.session.user?.email?.trim().toLowerCase() ?? "system";
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionKey: `inventory.cycle_count.${parsed.data.action}:${id}`, idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Idempotency key was already used with another request" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const loaded = await sup.client.from("inventory_cycle_counts").select("*,inventory_cycle_count_lines(*)").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (loaded.error || !loaded.data) {
    const body = { error: "Inventory cycle count not found" };
    await completeAdminIdempotency(sup.client, claim.id, 404, body);
    return correlatedJson(correlationId, body, { status: 404 });
  }
  const count = loaded.data as { id: string; status: string; revision: number; location_id: string; inventory_cycle_count_lines?: Array<{ id: string; product_id: string; variant_id: string; expected_quantity: number; counted_quantity: number | null }> };
  if (count.revision !== parsed.data.expectedRevision) {
    const body = { error: "Cycle count changed; refresh and retry", code: "INVENTORY_CYCLE_COUNT_CONFLICT" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  if (parsed.data.action === "cancel") {
    if (!["open"].includes(count.status)) {
      const body = { error: "Only open cycle counts can be cancelled", code: "INVENTORY_CYCLE_COUNT_INVALID_STATE" };
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    const update = await sup.client.from("inventory_cycle_counts").update({ status: "cancelled", revision: count.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", count.revision).select("*").single();
    if (update.error || !update.data) {
      const body = { error: "Cycle count was changed; refresh and retry", code: "INVENTORY_CYCLE_COUNT_CONFLICT" };
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    const body = { data: update.data };
    await completeAdminIdempotency(sup.client, claim.id, 200, body);
    return correlatedJson(correlationId, body);
  }
  if (parsed.data.action === "record") {
    if (count.status !== "open") {
      const body = { error: "Only open cycle counts can record quantities", code: "INVENTORY_CYCLE_COUNT_INVALID_STATE" };
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    const lineById = new Map((count.inventory_cycle_count_lines ?? []).map((line) => [line.id, line]));
    const lines = parsed.data.lines ?? [];
    if (lines.some((line) => !lineById.has(line.lineId))) {
      const body = { error: "Cycle count line does not belong to this count", code: "INVENTORY_CYCLE_COUNT_LINE_INVALID" };
      await completeAdminIdempotency(sup.client, claim.id, 400, body);
      return correlatedJson(correlationId, body, { status: 400 });
    }
    const recorded: Array<{ lineId: string; previous: number | null; next: number }> = [];
    for (const line of lines) {
      const previous = lineById.get(line.lineId)!.counted_quantity;
      const update = previous == null
        ? await sup.client.from("inventory_cycle_count_lines").update({ counted_quantity: line.countedQuantity }).eq("id", line.lineId).eq("cycle_count_id", id).is("counted_quantity", null).select("id").single()
        : await sup.client.from("inventory_cycle_count_lines").update({ counted_quantity: line.countedQuantity }).eq("id", line.lineId).eq("cycle_count_id", id).eq("counted_quantity", previous).select("id").single();
      if (update.error || !update.data) {
        for (const changed of recorded) {
          const rollback = sup.client.from("inventory_cycle_count_lines").update({ counted_quantity: changed.previous }).eq("id", changed.lineId).eq("cycle_count_id", id).eq("counted_quantity", changed.next);
          await rollback;
        }
        const body = { error: "Cycle count changed; refresh and retry", code: "INVENTORY_CYCLE_COUNT_CONFLICT" };
        await completeAdminIdempotency(sup.client, claim.id, 409, body);
        return correlatedJson(correlationId, body, { status: 409 });
      }
      recorded.push({ lineId: line.lineId, previous, next: line.countedQuantity });
    }
    const update = await sup.client.from("inventory_cycle_counts").update({ revision: count.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", count.revision).select("*").single();
    if (update.error || !update.data) {
      for (const changed of recorded) {
        await sup.client.from("inventory_cycle_count_lines").update({ counted_quantity: changed.previous }).eq("id", changed.lineId).eq("cycle_count_id", id).eq("counted_quantity", changed.next);
      }
      const body = { error: "Cycle count was changed; refresh and retry", code: "INVENTORY_CYCLE_COUNT_CONFLICT" };
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    await insertStaffAuditLog(sup.client, { actorEmail: actor, action: "inventory.cycle_count.record", resource: "inventory_cycle_count", resourceId: id, details: { organization_id: organization.id, lines: lines.length } });
    const body = { data: update.data };
    await completeAdminIdempotency(sup.client, claim.id, 200, body);
    return correlatedJson(correlationId, body);
  }
  if (count.status !== "open") {
    const body = { error: "Only open cycle counts can be completed", code: "INVENTORY_CYCLE_COUNT_INVALID_STATE" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const lines = count.inventory_cycle_count_lines ?? [];
  if (lines.length === 0 || lines.some((line) => line.counted_quantity == null)) {
    const body = { error: "Every cycle count line must be recorded before completion", code: "INVENTORY_CYCLE_COUNT_INCOMPLETE" };
    await completeAdminIdempotency(sup.client, claim.id, 400, body);
    return correlatedJson(correlationId, body, { status: 400 });
  }
  const processing = await sup.client.from("inventory_cycle_counts").update({ status: "processing", revision: count.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", count.revision).select("revision").single();
  if (processing.error || !processing.data) {
    const body = { error: "Cycle count was changed; refresh and retry", code: "INVENTORY_CYCLE_COUNT_CONFLICT" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const changes: InventoryStockChange[] = [];
  for (const line of lines) {
    const current = await fetchVariantStockedQuantity(line.variant_id, count.location_id);
    if (current == null || current !== line.expected_quantity) {
      const body = { error: "Inventory changed since the count started; create a new count", code: "INVENTORY_CYCLE_COUNT_STALE" };
      await sup.client.from("inventory_cycle_counts").update({ status: "failed", failure_code: body.code, failure_message: body.error, revision: count.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "processing");
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    changes.push({ productId: line.product_id, variantId: line.variant_id, locationId: count.location_id, quantityBefore: current, quantityAfter: line.counted_quantity! });
  }
  const applied = await applyInventoryStockChanges({ changes, client: sup.client, actorEmail: actor, correlationId, referenceType: "inventory_cycle_count", referenceId: id });
  if (!applied.ok) {
    await sup.client.from("inventory_cycle_counts").update({ status: "failed", failure_code: applied.code, failure_message: applied.message, revision: count.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "processing");
    const body = { error: applied.message, code: applied.code };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const completed = await sup.client.from("inventory_cycle_counts").update({ status: "completed", revision: count.revision + 2, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "processing").select("*").single();
  if (completed.error || !completed.data) {
    const body = { error: "Cycle count applied but its lifecycle record could not be finalized", code: "INVENTORY_CYCLE_COUNT_FINALIZE_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  await insertStaffAuditLog(sup.client, { actorEmail: actor, action: "inventory.cycle_count.complete", resource: "inventory_cycle_count", resourceId: id, details: { organization_id: organization.id, lines: lines.length } });
  const body = { data: completed.data };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
