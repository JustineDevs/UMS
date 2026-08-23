import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { z } from "zod";
import {
  attachMedusaInventoryReservation,
  closeMedusaInventoryReservation,
  commitInventoryReservation,
  releaseInventoryReservation,
  expireInventoryReservation,
} from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    operation: z.enum(["release", "commit", "attach_medusa", "close_medusa", "expire"]),
    medusaReservationId: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.operation === "attach_medusa" && !value.medusaReservationId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "medusaReservationId is required" });
    }
  });

type Params = { params: Promise<{ id: string }> };

async function post(request: Request, context: Params) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("inventory:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const body = await parseBoundedJson(request, 16 * 1024);
  if (body.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  const parsed = bodySchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(correlationId, { error: "Invalid reservation operation" }, { status: 400 });
  const { id } = await context.params;
  if (!id?.trim()) return correlatedJson(correlationId, { error: "Reservation not found" }, { status: 404 });
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  try {
    const input = { tenantId: organization.id, reservationId: id, idempotencyKey };
    const reservation = parsed.data.operation === "release"
      ? await releaseInventoryReservation(sup.client, input)
      : parsed.data.operation === "commit"
        ? await commitInventoryReservation(sup.client, input)
        : parsed.data.operation === "attach_medusa"
        ? await attachMedusaInventoryReservation(sup.client, { ...input, medusaReservationId: parsed.data.medusaReservationId! })
          : parsed.data.operation === "expire"
            ? await expireInventoryReservation(sup.client, input)
            : await closeMedusaInventoryReservation(sup.client, input);
    return correlatedJson(correlationId, { data: reservation }, { status: 200 });
  } catch {
    return correlatedJson(correlationId, { error: "Unable to update inventory reservation", code: "INVENTORY_RESERVATION_OPERATION_FAILED" }, { status: 409 });
  }
}

export const POST = withAdminMutationIdempotency("/admin/inventory/reservations/[id]:POST", post);
