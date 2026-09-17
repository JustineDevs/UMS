import { registerSseClient, unregisterSseClient } from "@/lib/admin-sse-hub";

type AdminSseStreamOptions = {
  encode?: (_value: string) => Uint8Array;
  beforeConnected?: (_controller: ReadableStreamDefaultController<Uint8Array>) => void;
};

export function createAdminSseStream(
  req: Request,
  userId: string,
  options: AdminSseStreamOptions = {},
): ReadableStream<Uint8Array> {
  const encode = options.encode ?? ((value: string) => new TextEncoder().encode(value));
  let closeStream = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const client = registerSseClient(controller, userId);
      let closed = false;
      const onAbort = () => cleanup();
      const cleanup = (closeController = true) => {
        if (closed) return;
        closed = true;
        req.signal.removeEventListener("abort", onAbort);
        unregisterSseClient(client);
        if (closeController) {
          try {
            controller.close();
          } catch {
            // The consumer may have already closed or errored the stream.
          }
        }
      };
      closeStream = cleanup;
      req.signal.addEventListener("abort", onAbort, { once: true });

      if (req.signal.aborted) {
        cleanup();
        return;
      }

      try {
        options.beforeConnected?.(controller);
        controller.enqueue(encode(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`));
      } catch (error) {
        cleanup(false);
        try {
          controller.error(error);
        } catch {
          // The stream is already closed; cleanup above is the invariant that matters.
        }
      }
    },
    cancel() {
      closeStream();
    },
  });
}
