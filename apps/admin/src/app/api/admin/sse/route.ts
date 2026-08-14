import { NextRequest } from "next/server";
import {
  registerSseClient,
  unregisterSseClient,
} from "@/lib/admin-sse-hub";
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

  const stream = new ReadableStream({
    start(controller) {
      const client = registerSseClient(controller, userId);
      controller.enqueue(
        new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`),
      );
      req.signal.addEventListener("abort", () => {
        unregisterSseClient(client);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
