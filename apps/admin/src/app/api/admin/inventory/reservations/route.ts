import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { z } from "zod";
import {
  reserveInventory,
  type InventoryReservationRow,
} from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { fetchVariantStockedQuantity } from "@/lib/medusa-catalog-inventory-stock";

export const dynamic = "force-dynamic";

const reserveSchema = z
  .object({
    locationId: z.string().trim().min(1).max(200).default("default"),
    inventoryItemId: z.string().trim().min(1).max(200),
    quantity: z.number().int().positive().max(1_000_000),
    referenceType: z.string().trim().max(100).optional(),
    referenceId: z.string().trim().max(200).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function row(row: InventoryReservationRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    inventoryItemId: row.inventory_item_id,
    quantity: row.quantity,
    status: row.status,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    medusaReservationId: row.medusa_reservation_id,
    reservedAt: row.reserved_at,
    releasedAt: row.released_at,
    committedAt: row.committed_at,
  };
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    staff.session.user?.email,
  );
  if (!organization) {
    return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  }
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  let query = sup.client
    .from("inventory_reservations")
    .select("id,tenant_id,location_id,inventory_item_id,quantity,status,reference_type,reference_id,medusa_reservation_id,reserved_at,released_at,committed_at")
    .eq("tenant_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const status = url.searchParams.get("status")?.trim();
  const inventoryItemId = url.searchParams.get("inventoryItemId")?.trim();
  if (status) query = query.eq("status", status);
  if (inventoryItemId) query = query.eq("inventory_item_id", inventoryItemId);
  const { data, error } = await query;
  if (error) return correlatedJson(correlationId, { error: "Unable to load inventory reservations", code: "INVENTORY_RESERVATIONS_FAILED" }, { status: 502 });
  return correlatedJson(correlationId, { data: data ?? [], organizationId: organization.id });
}

async function post(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) return correlatedJson(correlationId, { error: "Invalid reservation payload" }, { status: 400 });
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const availableQuantity = await fetchVariantStockedQuantity(parsed.data.inventoryItemId);
  if (availableQuantity == null) return correlatedJson(correlationId, { error: "Inventory quantity is unavailable" }, { status: 502 });
  try {
    const reservation = await reserveInventory(sup.client, {
      tenantId: organization.id,
      locationId: parsed.data.locationId,
      inventoryItemId: parsed.data.inventoryItemId,
      quantity: parsed.data.quantity,
      availableQuantity,
      idempotencyKey,
      referenceType: parsed.data.referenceType,
      referenceId: parsed.data.referenceId,
      metadata: parsed.data.metadata,
    });
    return correlatedJson(correlationId, { data: row(reservation) }, { status: 201 });
  } catch {
    return correlatedJson(correlationId, { error: "Unable to reserve inventory", code: "INVENTORY_RESERVATION_FAILED" }, { status: 409 });
  }
}

export const POST = withAdminMutationIdempotency("/admin/inventory/reservations:POST", post);
