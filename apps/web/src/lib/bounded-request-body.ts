const encoder = new TextEncoder();
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function containsDangerousJsonKey(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsDangerousJsonKey(item, seen));
  return Object.entries(value).some(([key, nested]) => DANGEROUS_KEYS.has(key) || containsDangerousJsonKey(nested, seen));
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<{ body: string; tooLarge: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) {
    const body = await request.text().catch(() => "");
    return { body, tooLarge: encoder.encode(body).byteLength > maxBytes };
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { body: "", tooLarge: true };
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes), tooLarge: false };
}

export async function parseBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<{ value: unknown; tooLarge: boolean; valid: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) {
    const body = await request.text().catch(() => "");
    if (encoder.encode(body).byteLength > maxBytes) return { value: null, tooLarge: true, valid: false };
    try {
      const value = JSON.parse(body || "null");
      return containsDangerousJsonKey(value)
        ? { value: null, tooLarge: false, valid: false }
        : { value, tooLarge: false, valid: true };
    } catch {
      return { value: null, tooLarge: false, valid: false };
    }
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { value: null, tooLarge: true, valid: false };
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes) || "null");
    return containsDangerousJsonKey(value)
      ? { value: null, tooLarge: false, valid: false }
      : { value, tooLarge: false, valid: true };
  } catch {
    return { value: null, tooLarge: false, valid: false };
  }
}
