import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

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
  if (!organization)
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variant_id")?.trim();
  const productId = url.searchParams.get("product_id")?.trim();
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit")) || 50),
  );
  let query = sup.client
    .from("staff_catalog_inventory_audit")
    .select(
      "id,created_at,actor_email,reason,reference_type,reference_id,product_id,variant_id,location_id,quantity_before,quantity_after,quantity_delta,correlation_id",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (variantId) query = query.eq("variant_id", variantId);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query;
  if (error)
    return correlatedJson(
      correlationId,
      {
        error: "Unable to load inventory ledger",
        code: "INVENTORY_LEDGER_FAILED",
      },
      { status: 502 },
    );
  return correlatedJson(correlationId, {
    data: data ?? [],
    organization_id: organization.id,
  });
}
