import { fetchMedusaInventoryPage } from "@/lib/medusa-inventory-bridge";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffSessionWithPermission } from "@/lib/requireStaffSession";
import { tagResponse } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 10_000;

const ALLOWED_PAGE_SIZES = new Set([25, 50, 100]);

function parseInventoryQuery(req: Request): { page: number; pageSize: number } {
  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sizeRaw = Number(url.searchParams.get("pageSize") ?? "25");
  const pageSize = ALLOWED_PAGE_SIZES.has(sizeRaw) ? sizeRaw : 25;
  return { page, pageSize };
}

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffSessionWithPermission("inventory:read");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  const { page, pageSize } = parseInventoryQuery(req);
  const offset = (page - 1) * pageSize;

  logAdminApiEvent({
    route: "GET /api/admin/inventory/stream",
    correlationId,
    phase: "start",
    detail: { page, pageSize },
  });

  const encoder = new TextEncoder();
  let closeStream = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // The consumer may have closed the stream before the abort event.
        }
      };
      closeStream = close;

      const send = async () => {
        if (closed) return;
        try {
          const result = await fetchMedusaInventoryPage({
            limit: pageSize,
            offset,
          });
          if (closed) return;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                rows: result.rows,
                page,
                pageSize,
                total: result.total,
              })}\n\n`,
            ),
          );
        } catch (e) {
          if (closed) return;
          const msg = e instanceof Error ? e.message : String(e);
          try {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`),
            );
          } catch {
            close();
          }
        }
      };

      await send();
      if (closed) return;
      interval = setInterval(() => {
        void send();
      }, TICK_MS);

      req.signal.addEventListener("abort", () => {
        close();
      });
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-request-id": correlationId,
    },
  });
}
