const textEncoder = new TextEncoder();

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<{ body: string; tooLarge: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) {
    const body = await request.text().catch(() => "");
    return { body, tooLarge: textEncoder.encode(body).byteLength > maxBytes };
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
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
  const result = await readBoundedRequestBody(request, maxBytes);
  if (result.tooLarge) return { value: null, tooLarge: true, valid: false };
  try {
    return { value: JSON.parse(result.body || "null"), tooLarge: false, valid: true };
  } catch {
    return { value: null, tooLarge: false, valid: false };
  }
}
