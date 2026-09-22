import { getAdminSession } from "./auth";
import { createInternalWorkerAdminToken } from "./worker-admin-bridge";
import { readResponseJson } from "./read-response-json";
import type { ZodType } from "zod";

const FORWARDED_HEADERS = ["accept", "content-type", "idempotency-key", "x-request-id", "x-admin-step-up", "x-device-id", "x-device-token", "x-forwarded-for"] as const;

/** Authenticated, no-fallback proxy for admin contracts owned by the Worker. */
export async function proxyWorkerAdminRoute(
  request: Request,
  workerPath: string,
  responseSchema?: ZodType,
): Promise<Response> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return Response.json({ error: "worker_api_not_configured" }, { status: 503 });

  const session = await getAdminSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const token = await createInternalWorkerAdminToken(session);
  if (!token) return Response.json({ error: "staff_organization_unavailable" }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const source = new URL(request.url);
  const target = new URL(`${base}${workerPath}`);
  target.search = source.search;
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });
  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control", "retry-after", "x-request-id", "referrer-policy"] as const) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Cache-Control", "no-store");
  if (!responseSchema || !response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  }
  const payload = await readResponseJson<unknown>(response, null);
  if (payload === null) return Response.json({ error: "worker_response_invalid", code: "WORKER_RESPONSE_INVALID" }, { status: 502, headers: responseHeaders });
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "worker_response_invalid", code: "WORKER_RESPONSE_INVALID" }, { status: 502, headers: responseHeaders });
  }
  return Response.json(parsed.data, { status: response.status, headers: responseHeaders });
}
