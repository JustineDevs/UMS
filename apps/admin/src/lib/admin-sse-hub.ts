type SSEClient = {
  controller: ReadableStreamDefaultController;
  userId: string;
};

const clients: SSEClient[] = [];

export function registerSseClient(controller: ReadableStreamDefaultController, userId: string) {
  const client: SSEClient = { controller, userId };
  clients.push(client);
  return client;
}

export function unregisterSseClient(client: SSEClient) {
  const idx = clients.indexOf(client);
  if (idx >= 0) clients.splice(idx, 1);
}
