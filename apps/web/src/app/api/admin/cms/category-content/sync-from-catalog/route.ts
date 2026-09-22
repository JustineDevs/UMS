import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCmsCategorySyncResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const source = new URL(request.url);
  const locale = source.searchParams.get("locale")?.trim() || process.env.NEXT_PUBLIC_CMS_LOCALE?.trim() || "en";
  source.search = new URLSearchParams({ locale }).toString();
  const headers = new Headers(request.headers);
  if (!headers.has("Idempotency-Key")) headers.set("Idempotency-Key", crypto.randomUUID());
  const proxied = new Request(source, { method: request.method, headers });
  return proxyWorkerAdminRoute(proxied, "/api/admin/cms/category-content/sync-from-catalog", adminCmsCategorySyncResponseSchema);
}
