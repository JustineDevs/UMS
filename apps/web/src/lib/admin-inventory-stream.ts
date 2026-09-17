import { fetchWorkerInventoryPage } from "@/lib/worker-admin-bridge";

const TICK_MS = 10_000;
type InventoryPage = Awaited<ReturnType<typeof fetchWorkerInventoryPage>>;
export type InventoryPageFetcher = (_input: { limit: number; offset: number; signal?: AbortSignal }) => Promise<InventoryPage>;

export function createInventoryStream(
  req: Request,
  input: {
    page: number;
    pageSize: number;
    offset: number;
    fetchPage?: InventoryPageFetcher;
  },
): ReadableStream<Uint8Array> {
  const { page, pageSize, offset, fetchPage = fetchWorkerInventoryPage } = input;
  const encoder = new TextEncoder();
  let closeStream = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | undefined;
      let sendInFlight = false;

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // The consumer may have closed the stream before the abort event.
        }
      };
      closeStream = close;
      const onAbort = () => close();
      req.signal.addEventListener("abort", onAbort, { once: true });

      if (req.signal.aborted) {
        close();
        return;
      }

      const send = async () => {
        if (closed || sendInFlight) return;
        sendInFlight = true;
        try {
          const result = await fetchPage({ limit: pageSize, offset, signal: req.signal });
          if (closed) return;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ rows: result.rows, page, pageSize, total: result.total })}\n\n`,
            ),
          );
        } catch (error) {
          if (closed) return;
          const message = error instanceof Error ? error.message : String(error);
          try {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
            );
          } catch {
            close();
          }
        } finally {
          sendInFlight = false;
        }
      };

      await send();
      if (closed) return;
      interval = setInterval(() => void send(), TICK_MS);
    },
    cancel() {
      closeStream();
    },
  });
  return stream;
}
