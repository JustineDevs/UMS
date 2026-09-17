import { NextResponse } from "next/server";
import { expireDueInventoryReservations } from "@universal-music-store/platform-data";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { collectActiveReservationTenants } from "@/lib/inventory-reservation-cron";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? req.headers.get("x-cron-secret")?.trim();
  return Boolean(expected && actual && expected === actual);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createStorefrontServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  let tenants: string[];
  try {
    tenants = await collectActiveReservationTenants(async (from, to) => {
      const { data, error } = await supabase
        .from("inventory_reservations")
        .select("tenant_id")
        .eq("status", "active")
        .not("expires_at", "is", null)
        .order("tenant_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as { tenant_id?: unknown }[];
    });
  } catch {
    return NextResponse.json({ error: "Unable to load reservation tenants" }, { status: 502 });
  }
  let expired = 0;
  for (const tenantId of tenants) expired += await expireDueInventoryReservations(supabase, { tenantId });
  return NextResponse.json({ processed: tenants.length, expired });
}
