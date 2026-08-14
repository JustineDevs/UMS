/**
 * POST raw ESC/POS bytes to an HTTP endpoint (reverse proxy, Epson raw gateway, QZ sidecar).
 */
export async function postOctetStreamPrint(
  url: string,
  bytes: Uint8Array,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      ...extraHeaders,
    },
    body: Buffer.from(bytes),
  });
  if (!res.ok) {
    throw new Error(`HTTP print relay failed ${res.status}`);
  }
}
