type SSEClient = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  userId: string;
};

const clients = new Set<SSEClient>();

export function registerSseClient(
  controller: ReadableStreamDefaultController<Uint8Array>,
  userId: string,
) {
  const client: SSEClient = { controller, userId };
  clients.add(client);
  return client;
}

export function unregisterSseClient(client: SSEClient) {
  clients.delete(client);
}

export function getRegisteredSseClientCount(): number {
  return clients.size;
}

/**
 * Delivers an event to a snapshot of the current clients. A client that has
 * already disconnected is removed immediately; this keeps the process-local
 * registry bounded even when the platform does not deliver cancellation in
 * the same turn as a broken connection.
 */
export function publishSseEvent(
  event: string,
  data: unknown,
  encode: (_value: string) => Uint8Array = (value) => new TextEncoder().encode(value),
): number {
  const payload = encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let delivered = 0;
  for (const client of [...clients]) {
    try {
      client.controller.enqueue(payload);
      delivered += 1;
    } catch {
      clients.delete(client);
    }
  }
  return delivered;
}
