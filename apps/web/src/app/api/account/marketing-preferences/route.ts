import { isSameOriginMutation } from "@/lib/request-origin";
import { parseAdminJson } from "@/lib/admin-api-security";
import { accountMarketingPreferencesPatchSchema, accountMarketingPreferencesResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";
import { getStorefrontWorkerAuth } from "@/lib/storefront-worker-auth";

export const dynamic = "force-dynamic";

async function workerRequest(request: Request, body?: string): Promise<Response> {
  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return Response.json({ error: "Account preferences are unavailable." }, { status: 503 });
  const auth = await getStorefrontWorkerAuth();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const response = await fetch(`${baseUrl}/store/customers/me/marketing-preferences`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...(request.method === "PATCH" ? { "Content-Type": "application/json" } : {}),
    },
    ...(request.method === "PATCH" ? { body: body ?? await request.text() } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const payload = await readResponseJson(response, { error: "invalid_worker_response" });
    return Response.json(payload, { status: response.status >= 500 ? 503 : response.status });
  }
  const payload = await readResponseJson(response, { error: "invalid_worker_response" });
  const parsed = accountMarketingPreferencesResponseSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "invalid_worker_response" }, { status: 502 });
  return Response.json(parsed.data, { status: 200 });
}

export async function GET(request: Request) { return workerRequest(request); }

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const parsed = await parseAdminJson(request, accountMarketingPreferencesPatchSchema, 16 * 1024);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
  return workerRequest(request, JSON.stringify(parsed.data));
}
