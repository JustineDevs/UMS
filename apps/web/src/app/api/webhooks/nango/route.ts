const RESPONSE_HEADERS = ["content-type", "retry-after", "x-request-id"] as const;
import { readResponseJson } from "@/lib/read-response-json";
import { nangoWebhookResponseSchema } from "@/lib/admin-api-contracts";

export async function POST(request: Request): Promise<Response> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return Response.json({ error: "worker_api_not_configured" }, { status: 503 });
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "x-nango-hmac-sha256", "x-nango-event-id", "x-nango-webhook-id"] as const) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(`${base}/api/webhooks/nango`, {
    method: "POST",
    headers,
    body: await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });
  const forwarded = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  forwarded.set("Cache-Control", "no-store");
  forwarded.set("Referrer-Policy", "no-referrer");
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return new Response(response.body, { status: response.status, headers: forwarded });
  }
  const payload = await readResponseJson(response, null, { maxBytes: 16 * 1024 });
  const parsed = nangoWebhookResponseSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Webhook returned an invalid response" }, { status: 502, headers: forwarded });
  return Response.json(parsed.data, { status: response.status, headers: forwarded });
}
