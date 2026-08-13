import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("channels:manage");
  if (!staff.ok) return staff.response;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const rawLimit = Number(new URL(req.url).searchParams.get("limit") ?? 80);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 80, 1), 100);
  const { data, error } = await sup.client.from("channel_sync_events").select("id, channel, event_type, received_at, processed_at").order("received_at", { ascending: false }).limit(limit);
  if (error) return correlatedJson(correlationId, { error: "Unable to load channel events" }, { status: 502 });
  return correlatedJson(correlationId, { events: data ?? [] });
}
