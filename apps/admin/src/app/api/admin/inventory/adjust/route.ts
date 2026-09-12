import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { z } from "zod";
import {
  applyVariantStockedQuantity,
  fetchVariantAvailableQuantity,
  fetchVariantStockedQuantity,
} from "@/lib/medusa-catalog-inventory-stock";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import {
  parseAdminJson,
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
} from "@/lib/admin-api-security";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { recordInventoryMovementAudit } from "@/lib/inventory-movement-audit";

const schema = z
  .object({
    productId: z.string().trim().min(1).max(200),
    variantId: z.string().trim().min(1).max(200),
    stockedQuantity: z.number().int().min(0).max(1_000_000).optional(),
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    expectedStockedQuantity: z.number().int().min(0).max(1_000_000).optional(),
    locationId: z.string().trim().min(1).max(200).optional(),
    reason: z
      .enum([
        "receive",
        "count",
        "damage",
        "loss",
        "return",
        "correction",
        "transfer",
      ])
      .default("correction"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.stockedQuantity == null) === (value.delta == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of stockedQuantity or delta",
      });
    }
  });

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email)
    return correlatedJson(
      correlationId,
      { error: "Unauthorized" },
      { status: 401 },
    );
  if (!staffSessionAllows(session, "inventory:write"))
    return correlatedJson(
      correlationId,
      { error: "Forbidden" },
      { status: 403 },
    );
  const parsed = await parseAdminJson(req, schema);
  if (!parsed.ok)
    return correlatedJson(
      correlationId,
      { error: parsed.error },
      { status: parsed.status },
    );
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    session.user.email,
  );
  if (!organization)
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey)
    return correlatedJson(
      correlationId,
      { error: "Idempotency-Key is required" },
      { status: 400 },
    );
  const claim = await claimAdminIdempotency(sup.client, {
    actorKey: `${organization.id}:${session.user.email.toLowerCase()}`,
    actionKey: `inventory.adjust:${parsed.data.variantId}`,
    idempotencyKey,
    requestHash: getRequestHash(parsed.data),
  });
  if (claim.kind === "replay")
    return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict")
    return correlatedJson(
      correlationId,
      { error: "Idempotency key is already in use" },
      { status: 409 },
    );
  if (claim.kind !== "claimed")
    return correlatedJson(
      correlationId,
      { error: "Idempotency service unavailable" },
      { status: 503 },
    );
  const before = await fetchVariantStockedQuantity(
    parsed.data.variantId,
    parsed.data.locationId,
  );
  if (before == null) {
    const body = { error: "Inventory quantity is unavailable" };
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }
  if (
    parsed.data.expectedStockedQuantity != null &&
    parsed.data.expectedStockedQuantity !== before
  ) {
    const body = { error: "Inventory changed; reload before adjusting" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const stockedQuantity =
    parsed.data.delta != null
      ? before + parsed.data.delta
      : parsed.data.stockedQuantity!;
  if (stockedQuantity < 0 || stockedQuantity > 1_000_000) {
    const body = { error: "Inventory quantity is out of range" };
    await completeAdminIdempotency(sup.client, claim.id, 400, body);
    return correlatedJson(correlationId, body, { status: 400 });
  }
  const result = await applyVariantStockedQuantity({
    ...parsed.data,
    stockedQuantity,
  });
  if (!result.ok) {
    const body = { error: "Unable to update inventory" };
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }
  const availableQuantity = await fetchVariantAvailableQuantity(parsed.data.variantId);
  await recordInventoryMovementAudit(sup.client, {
    actorEmail: session.user.email,
    reason: parsed.data.reason ?? "correction",
    referenceType: "inventory_adjustment",
    referenceId: idempotencyKey,
    productId: parsed.data.productId,
    variantId: parsed.data.variantId,
    inventoryItemId: null,
    locationId: parsed.data.locationId ?? "default",
    quantityBefore: before,
    quantityAfter: stockedQuantity,
    correlationId,
    organizationId: organization.id,
  });
  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email,
    action: "inventory.adjust",
    resource: "inventory_variant",
    resourceId: parsed.data.variantId,
    details: {
      organization_id: organization.id,
      product_id: parsed.data.productId,
      reason: parsed.data.reason,
      location_id: parsed.data.locationId ?? null,
      stocked_quantity: stockedQuantity,
      delta: stockedQuantity - before,
      before,
    },
  });
  const body = {
    data: {
      variantId: parsed.data.variantId,
      stockedQuantity,
      availableQuantity,
      delta: stockedQuantity - before,
      reason: parsed.data.reason,
    },
  };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
