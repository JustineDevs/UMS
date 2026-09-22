import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  createWorkerProductCategoryForAdmin,
  fetchWorkerProductCategoriesForAdmin,
} from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { adminCatalogCategoryCreateSchema, adminCatalogCategoriesResponseSchema, adminCatalogCategoryCreateResponseSchema } from "@/lib/admin-api-contracts";
import { parseAdminJson } from "@/lib/admin-api-security";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

async function post(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
  }
  if (!staffSessionAllows(session, "catalog:write")) {
    return correlatedError(correlationId, 403, "Forbidden", "FORBIDDEN");
  }
  const parsedBody = await parseAdminJson(req, adminCatalogCategoryCreateSchema, 16 * 1024);
  if (!parsedBody.ok) return correlatedError(correlationId, parsedBody.status, parsedBody.error, "VALIDATION_ERROR");
  const body = parsedBody.data;
  if (process.env.API_URL?.trim()) {
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) return correlatedError(correlationId, 400, "Idempotency-Key is required", "BAD_REQUEST");
    const response = await createWorkerProductCategoryForAdmin({
      name: body.name,
      handle: body.handle,
      idempotencyKey,
    });
    if (!response) return correlatedError(correlationId, 503, "Commerce Worker is unavailable", "SERVICE_UNAVAILABLE");
    const payload = await readResponseJson<unknown>(response, null);
    if (!response.ok) {
      const code = response.status === 409 ? "CONFLICT" : "VALIDATION_ERROR";
      return correlatedError(correlationId, response.status, "Category creation failed", code);
    }
    const parsed = adminCatalogCategoryCreateResponseSchema.safeParse(payload);
    if (!parsed.success) return correlatedError(correlationId, 502, "Commerce Worker returned an invalid category response", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, parsed.data, { status: response.status });
  }
  return correlatedError(correlationId, 503, "Commerce Worker is unavailable", "SERVICE_UNAVAILABLE");
}

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
  }
  if (!staffSessionAllows(session, "catalog:read")) {
    return correlatedError(correlationId, 403, "Forbidden", "FORBIDDEN");
  }

  if (process.env.API_URL?.trim()) {
    const categories = await fetchWorkerProductCategoriesForAdmin();
    if (categories === null) return correlatedError(correlationId, 503, "Commerce Worker is unavailable", "SERVICE_UNAVAILABLE");
    const parsed = adminCatalogCategoriesResponseSchema.safeParse({ categories });
    if (!parsed.success) return correlatedError(correlationId, 502, "Commerce Worker returned an invalid category response", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, parsed.data);
  }

  return correlatedError(correlationId, 503, "Commerce Worker is unavailable", "SERVICE_UNAVAILABLE");
}

export const POST = post;
