import { NextRequest } from "next/server";
import { createAdminSseStream } from "@/lib/admin-sse-stream";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { tagResponse } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) {
    return tagResponse(staff.response, cid);
  }
  const userId = staff.session.user?.email ?? "anon";

  const stream = createAdminSseStream(req, userId);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
