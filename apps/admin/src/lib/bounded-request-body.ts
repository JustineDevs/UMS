const encoder = new TextEncoder();

export async function parseBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<{ value: unknown; tooLarge: boolean; valid: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) {
    const body = await request.text().catch(() => "");
    if (encoder.encode(body).byteLength > maxBytes) return { value: null, tooLarge: true, valid: false };
    try {
      return { value: JSON.parse(body || "null"), tooLarge: false, valid: true };
    } catch {
      return { value: null, tooLarge: false, valid: false };
    }
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
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
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes) || "null"), tooLarge: false, valid: true };
  } catch {
    return { value: null, tooLarge: false, valid: false };
  }
}
