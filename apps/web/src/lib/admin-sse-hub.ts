type SSEClient = {
  controller: ReadableStreamDefaultController;
  userId: string;
};

const clients = new Set<SSEClient>();

export function registerSseClient(controller: ReadableStreamDefaultController, userId: string) {
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
