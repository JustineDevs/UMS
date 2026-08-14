import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { listEntityWorkflows } from "@/lib/admin-workflow";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export const dynamic = "force-dynamic";

/**
 * Lists recent `admin_entity_workflow` rows (catalog, CMS, campaigns, etc.).
 * Permission: `dashboard:read`.
 */
export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const auth = await requireStaffApiSession("dashboard:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
  const entityType = url.searchParams.get("entity_type")?.trim() || undefined;

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    auth.session.user?.email,
  );
  if (!organization) {
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  }

  try {
    const rows = await listEntityWorkflows(sup.client, {
      organizationId: organization.id,
      limit,
      offset,
      entityType,
    });
    return correlatedJson(correlationId, { rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workflow list unavailable";
    return correlatedJson(correlationId, { error: message }, { status: 502 });
  }
}
