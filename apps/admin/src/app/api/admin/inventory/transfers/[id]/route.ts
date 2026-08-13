import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";
import { applyInventoryStockChanges, type InventoryStockChange } from "@/lib/inventory-lifecycle";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { tryCreateSupabaseClient } from "@universal-music-store/platform-data";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const actionSchema = z.object({
  action: z.enum(["approve", "ship", "complete", "cancel"]),
  expectedRevision: z.number().int().positive(),
}).strict();

type AdminSupabaseClient = NonNullable<ReturnType<typeof tryCreateSupabaseClient>>;

async function loadTransfer(client: AdminSupabaseClient, id: string, organizationId: string) {
  return client.from("inventory_transfers").select("*,inventory_transfer_lines(*)").eq("id", id).eq("organization_id", organizationId).maybeSingle();
}

export async function GET(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const { id } = await context.params;
  const result = await loadTransfer(sup.client, id, organization.id);
  if (result.error) return correlatedJson(correlationId, { error: "Unable to load inventory transfer" }, { status: 502 });
  if (!result.data) return correlatedJson(correlationId, { error: "Inventory transfer not found" }, { status: 404 });
  return correlatedJson(correlationId, { data: result.data });
}

export async function POST(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = await parseAdminJson(request, actionSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const { id } = await context.params;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const actor = staff.session.user?.email?.trim().toLowerCase() ?? "system";
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionKey: `inventory.transfer.${parsed.data.action}:${id}`, idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Idempotency key was already used with another request" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const loaded = await loadTransfer(sup.client, id, organization.id);
  if (loaded.error || !loaded.data) {
    const body = { error: "Inventory transfer not found" };
    await completeAdminIdempotency(sup.client, claim.id, 404, body);
    return correlatedJson(correlationId, body, { status: 404 });
  }
  const transfer = loaded.data as { id: string; status: string; revision: number; source_location_id: string; destination_location_id: string; inventory_transfer_lines?: Array<{ product_id: string; variant_id: string; quantity: number }> };
  if (transfer.revision !== parsed.data.expectedRevision) {
    const body = { error: "Inventory transfer changed; refresh and retry", code: "INVENTORY_TRANSFER_CONFLICT" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const transitions: Record<string, string[]> = { approve: ["draft"], ship: ["approved"], complete: ["in_transit"], cancel: ["draft", "approved", "in_transit"] };
  if (!transitions[parsed.data.action]?.includes(transfer.status)) {
    const body = { error: `Cannot ${parsed.data.action} a transfer in its current state`, code: "INVENTORY_TRANSFER_INVALID_STATE" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  if (parsed.data.action !== "complete") {
    const next = parsed.data.action === "approve" ? "approved" : parsed.data.action === "ship" ? "in_transit" : "cancelled";
    const update = await sup.client.from("inventory_transfers").update({ status: next, revision: transfer.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", transfer.revision).select("*").single();
    if (update.error || !update.data) {
      const body = { error: "Inventory transfer was changed; refresh and retry", code: "INVENTORY_TRANSFER_CONFLICT" };
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    await insertStaffAuditLog(sup.client, { actorEmail: actor, action: `inventory.transfer.${parsed.data.action}`, resource: "inventory_transfer", resourceId: id, details: { organization_id: organization.id, status: next } });
    const body = { data: update.data };
    await completeAdminIdempotency(sup.client, claim.id, 200, body);
    return correlatedJson(correlationId, body);
  }

  const processing = await sup.client.from("inventory_transfers").update({ status: "processing", revision: transfer.revision + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("revision", transfer.revision).select("revision").single();
  if (processing.error || !processing.data) {
    const body = { error: "Inventory transfer was changed; refresh and retry", code: "INVENTORY_TRANSFER_CONFLICT" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const changes: InventoryStockChange[] = [];
  for (const line of transfer.inventory_transfer_lines ?? []) {
    const source = await (await import("@/lib/medusa-catalog-inventory-stock")).fetchVariantStockedQuantity(line.variant_id, transfer.source_location_id);
    const destination = await (await import("@/lib/medusa-catalog-inventory-stock")).fetchVariantStockedQuantity(line.variant_id, transfer.destination_location_id);
    if (source == null || destination == null || source < line.quantity) {
      const body = { error: "Unable to complete transfer because source inventory is unavailable or insufficient", code: source != null && source < line.quantity ? "INSUFFICIENT_INVENTORY" : "INVENTORY_READ_FAILED" };
      await sup.client.from("inventory_transfers").update({ status: "failed", failure_code: body.code, failure_message: body.error, revision: transfer.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "processing");
      await completeAdminIdempotency(sup.client, claim.id, 409, body);
      return correlatedJson(correlationId, body, { status: 409 });
    }
    changes.push({ productId: line.product_id, variantId: line.variant_id, locationId: transfer.source_location_id, quantityBefore: source, quantityAfter: source - line.quantity });
    changes.push({ productId: line.product_id, variantId: line.variant_id, locationId: transfer.destination_location_id, quantityBefore: destination, quantityAfter: destination + line.quantity });
  }
  const applied = await applyInventoryStockChanges({ changes, client: sup.client, actorEmail: actor, correlationId, referenceType: "inventory_transfer", referenceId: id });
  if (!applied.ok) {
    await sup.client.from("inventory_transfers").update({ status: "failed", failure_code: applied.code, failure_message: applied.message, revision: transfer.revision + 2, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "processing");
    const body = { error: applied.message, code: applied.code };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const completed = await sup.client.from("inventory_transfers").update({ status: "completed", revision: transfer.revision + 2, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id).eq("status", "processing").select("*").single();
  if (completed.error || !completed.data) {
    const body = { error: "Inventory transfer completed but its lifecycle record could not be finalized", code: "INVENTORY_TRANSFER_FINALIZE_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 503, body);
    return correlatedJson(correlationId, body, { status: 503 });
  }
  await insertStaffAuditLog(sup.client, { actorEmail: actor, action: "inventory.transfer.complete", resource: "inventory_transfer", resourceId: id, details: { organization_id: organization.id } });
  const body = { data: completed.data };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
