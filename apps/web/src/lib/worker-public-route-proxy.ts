const WEBHOOK_HEADERS = [
  "content-type",
  "x-channel-nonce",
  "x-channel-signature",
  "x-channel-timestamp",
  "x-request-id",
  "x-tenant-key",
  "x-telemetry-signature",
  "x-telemetry-timestamp",
  "idempotency-key",
] as const;
const MAX_BODY_BYTES = 512_000;
import type { ZodType } from "zod";
import { readResponseJson } from "./read-response-json";

/** Proxy a signed integration request without forwarding browser credentials or secrets. */
export async function proxyWorkerPublicRoute(request: Request, workerPath: string, responseSchema?: ZodType): Promise<Response> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return Response.json({ error: "worker_api_not_configured" }, { status: 503 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bodyLength = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bodyLength += value.byteLength;
        if (bodyLength > MAX_BODY_BYTES) {
          await reader.cancel();
          return Response.json({ error: "payload_too_large" }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const body = new Uint8Array(bodyLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers();
  for (const name of WEBHOOK_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const target = new URL(workerPath, `${base}/`);
  const response = await fetch(target, { method: "POST", headers, body, cache: "no-store", redirect: "manual" });
  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control", "retry-after", "x-request-id", "referrer-policy"] as const) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Cache-Control", "no-store");
  if (responseSchema && response.ok && response.headers.get("content-type")?.includes("application/json")) {
    const payload = await readResponseJson(response, null);
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) return Response.json({ error: "worker_response_invalid", code: "WORKER_RESPONSE_INVALID" }, { status: 502, headers: responseHeaders });
    return Response.json(parsed.data, { status: response.status, headers: responseHeaders });
  }
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}
