import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { insertStaffAuditLog } from "@/lib/staff-audit";

async function post(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("channels:manage");
  if (!staff.ok) return staff.response;
  const { id } = await params;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const processedAt = new Date().toISOString();
  const { data, error } = await sup.client.from("channel_sync_events").update({ processed_at: processedAt }).eq("id", id).is("processed_at", null).select("id, processed_at").maybeSingle();
  if (error) return correlatedJson(correlationId, { error: "Unable to process channel event" }, { status: 502 });
  if (!data) return correlatedJson(correlationId, { error: "Event is unavailable or already processed" }, { status: 409 });
  await insertStaffAuditLog(sup.client, { actorEmail: staff.session.user?.email ?? "local-admin@localhost", action: "channel_event.process", resource: "channel_sync_event", resourceId: id, details: { processed_at: processedAt } });
  return correlatedJson(correlationId, { event: data });
}

export const POST = withAdminMutationIdempotency("/admin/channels/events/[id]/process:POST", post);
