import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getDeliveryLogisticsOverview } from "@/lib/delivery-logistics";

export async function GET() {
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const overview = await getDeliveryLogisticsOverview();
  return NextResponse.json({
    ok: true,
    overview,
  });
}
