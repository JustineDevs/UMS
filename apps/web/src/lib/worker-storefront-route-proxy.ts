import { createSupabaseServerClient } from "./supabase/server";
import { createHmac } from "node:crypto";
import { readResponseJson } from "./read-response-json";

const FORWARDED_HEADERS = ["accept", "content-type", "cookie", "x-forwarded-for", "x-request-id"] as const;
const DEFAULT_MAX_BODY_BYTES = 8 * 1024;
type ResponseSchema = { safeParse: (_value: unknown) => { success: boolean; data?: unknown } };

/** Proxies a browser storefront mutation to its Worker owner with the user's access token. */
export async function proxyWorkerStorefrontRoute(request: Request, workerPath: string, maxBodyBytes = DEFAULT_MAX_BODY_BYTES, responseSchema?: ResponseSchema): Promise<Response> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return Response.json({ error: "worker_api_not_configured" }, { status: 503 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > maxBodyBytes) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const headers = new Headers();
  const token = data.session?.access_token?.trim();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > maxBodyBytes) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const secret = process.env.AUTH_SECRET?.trim();
  if (body && secret) headers.set("x-storefront-signature", createHmac("sha256", secret).update(Buffer.from(body)).digest("base64url"));
  const target = new URL(workerPath, `${base}/`);
  const response = await fetch(target, { method: request.method, headers, body, cache: "no-store", redirect: "manual" });
  if (response.ok && responseSchema) {
    const payload = await readResponseJson(response, null);
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) return Response.json({ error: "invalid_worker_response" }, { status: 502 });
    return Response.json(parsed.data, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control", "retry-after", "x-request-id", "referrer-policy"] as const) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}
