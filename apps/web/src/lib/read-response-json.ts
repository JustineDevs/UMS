/**
 * Read an upstream JSON response only after classifying its HTTP status.
 * Error bodies are still preserved for callers that intentionally forward a
 * safe provider/Worker error envelope.
 */
export async function readResponseJson<T>(
  response: Response,
  fallback: T,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 1_048_576));
  try {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > maxBytes) return fallback;
    if (!response.body) return fallback;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel("response_too_large").catch(() => undefined);
          return fallback;
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return fallback;
  }
}
