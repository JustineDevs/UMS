import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";
import { applyInventoryStockChanges, type InventoryStockChange } from "@/lib/inventory-lifecycle";
import { insertStaffAuditLog } from "@/lib/staff-audit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  action: z.enum(["submit", "receive", "cancel"]),
  expectedRevision: z.number().int().positive(),
  lines: z.array(z.object({ lineId: z.string().uuid(), quantity: z.number().int().positive().max(1_000_000) }).strict()).max(100).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === "receive" && (!value.lines || value.lines.length === 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Receive lines are required" });
  if (value.lines && new Set(value.lines.map((line) => line.lineId)).size !== value.lines.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "A line may only be received once" });
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
  const result = await sup.client.from("inventory_purchase_orders").select("*,inventory_purchase_order_lines(*)").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (result.error) return correlatedJson(correlationId, { error: "Unable to load inventory purchase order" }, { status: 502 });
  if (!result.data) return correlatedJson(correlationId, { error: "Inventory purchase order not found" }, { status: 404 });
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
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionKey: `inventory.purchase_order.${parsed.data.action}:${id}`, idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Idempotency key was already used with another request" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const loaded = await sup.client.from("inventory_purchase_orders").select("*,inventory_purchase_order_lines(*)").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (loaded.error || !loaded.data) {
    const body = { error: "Inventory purchase order not found" };
    await completeAdminIdempotency(sup.client, claim.id, 404, body);
    return correlatedJson(correlationId, body, { status: 404 });
  }
  const po = loaded.data as { id: string; status: string; revision: number; destination_location_id: string; inventory_purchase_order_lines?: Array<{ id: string; product_id: string; variant_id: string; ordered_quantity: number; received_quantity: number }> };
  if (po.revision !== parsed.data.expectedRevision) {
    const body = { error: "Purchase order changed; refresh and retry", code: "INVENTORY_PURCHASE_ORDER_CONFLICT" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const allowed: Record<string, string[]> = { submit: ["draft"], cancel: ["draft", "submitted", "partially_received"], receive: ["submitted", "partially_received"] };
  if (!allowed[parsed.data.action]?.includes(po.status)) {
    const body = { error: `Cannot ${parsed.data.action} a purchase order in its current state`, code: "INVENTORY_PURCHASE_ORDER_INVALID_STATE" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  if (parsed.data.action !== "receive") {
    const next = parsed.data.action === "submit" ? "submitted" : "cancelled";
    const update = await sup.client.from("inventory_purchase_orders").update({ status: next, revision: po.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", po.revision).select("*").single();
    if (update.error || !update.data) {
      const body = { error: "Purchase order was changed; refresh and retry", code: "INVENTORY_PURCHASE_ORDER_CONFLICT" };
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    await insertStaffAuditLog(sup.client, { actorEmail: actor, action: `inventory.purchase_order.${parsed.data.action}`, resource: "inventory_purchase_order", resourceId: id, details: { organization_id: organization.id, status: next } });
    const body = { data: update.data };
    await completeAdminIdempotency(sup.client, claim.id, 200, body);
    return correlatedJson(correlationId, body);
  }

  const incoming = new Map((parsed.data.lines ?? []).map((line) => [line.lineId, line.quantity]));
  const updates = (po.inventory_purchase_order_lines ?? []).filter((line) => incoming.has(line.id)).map((line) => ({ line, quantity: incoming.get(line.id)! }));
  if (updates.length === 0 || updates.some(({ line, quantity }) => line.received_quantity + quantity > line.ordered_quantity)) {
    const body = { error: "Received quantities exceed the purchase order", code: "INVENTORY_RECEIPT_QUANTITY_INVALID" };
    await completeAdminIdempotency(sup.client, claim.id, 400, body);
    return correlatedJson(correlationId, body, { status: 400 });
  }
  const processing = await sup.client.from("inventory_purchase_orders").update({ status: "receiving", revision: po.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", po.revision).select("revision").single();
  if (processing.error || !processing.data) {
    const body = { error: "Purchase order was changed; refresh and retry", code: "INVENTORY_PURCHASE_ORDER_CONFLICT" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const changes: InventoryStockChange[] = [];
  const updatedLines: Array<{ lineId: string; previous: number; next: number }> = [];
  for (const { line, quantity } of updates) {
    const current = await (await import("@/lib/medusa-catalog-inventory-stock")).fetchVariantStockedQuantity(line.variant_id, po.destination_location_id);
    if (current == null) {
      const body = { error: "Inventory quantity is unavailable", code: "INVENTORY_READ_FAILED" };
      await sup.client.from("inventory_purchase_orders").update({ status: "receive_failed", failure_code: body.code, failure_message: body.error, revision: po.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "receiving");
      await completeAdminIdempotency(sup.client, claim.id, 502, body);
      return correlatedJson(correlationId, body, { status: 502 });
    }
    changes.push({ productId: line.product_id, variantId: line.variant_id, locationId: po.destination_location_id, quantityBefore: current, quantityAfter: current + quantity });
    updatedLines.push({ lineId: line.id, previous: line.received_quantity, next: line.received_quantity + quantity });
  }
  for (const line of updatedLines) {
    const update = await sup.client.from("inventory_purchase_order_lines").update({ received_quantity: line.next }).eq("id", line.lineId).eq("purchase_order_id", id).eq("received_quantity", line.previous).select("id").single();
    if (update.error || !update.data) {
      for (const previous of updatedLines) {
        if (previous.lineId === line.lineId) break;
        await sup.client.from("inventory_purchase_order_lines").update({ received_quantity: previous.previous }).eq("id", previous.lineId).eq("purchase_order_id", id).eq("received_quantity", previous.next);
      }
      const body = { error: "Unable to persist received quantities", code: "INVENTORY_RECEIPT_PERSIST_FAILED" };
      await sup.client.from("inventory_purchase_orders").update({ status: "receive_failed", failure_code: body.code, failure_message: body.error, revision: po.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "receiving");
      await completeAdminIdempotency(sup.client, claim.id, 503, body);
      return correlatedJson(correlationId, body, { status: 503 });
    }
  }
  const applied = await applyInventoryStockChanges({ changes, client: sup.client, actorEmail: actor, correlationId, referenceType: "inventory_purchase_order_receipt", referenceId: id });
  if (!applied.ok) {
    for (const line of updatedLines) await sup.client.from("inventory_purchase_order_lines").update({ received_quantity: line.previous }).eq("id", line.lineId).eq("purchase_order_id", id).eq("received_quantity", line.next);
    await sup.client.from("inventory_purchase_orders").update({ status: "receive_failed", failure_code: applied.code, failure_message: applied.message, revision: po.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "receiving");
    const body = { error: applied.message, code: applied.code };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const allReceived = (po.inventory_purchase_order_lines ?? []).every((line) => line.received_quantity + (incoming.get(line.id) ?? 0) === line.ordered_quantity);
  const completed = await sup.client.from("inventory_purchase_orders").update({ status: allReceived ? "received" : "partially_received", revision: po.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "receiving").select("*").single();
  if (completed.error || !completed.data) {
    const body = { error: "Purchase receipt applied but its lifecycle record could not be finalized", code: "INVENTORY_RECEIPT_FINALIZE_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  await insertStaffAuditLog(sup.client, { actorEmail: actor, action: "inventory.purchase_order.receive", resource: "inventory_purchase_order", resourceId: id, details: { organization_id: organization.id, received_lines: updatedLines.length } });
  const body = { data: completed.data };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
