import { fetchPaymentAttemptInvalidationDayBuckets } from "@universal-music-store/platform-data";
import { randomUUID } from "crypto";

import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = randomUUID();
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days")) || 14));

  try {
    const buckets = await fetchPaymentAttemptInvalidationDayBuckets(sup.client, days);
    const total = buckets.reduce((acc, b) => acc + b.count, 0);
    return correlatedJson(correlationId, {
      days,
      buckets,
      totalInvalidationsInWindow: total,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Metrics failed";
    return correlatedJson(correlationId, { error: msg }, { status: 500 });
  }
}
