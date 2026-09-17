import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  createAdminProductCategory,
  listAdminProductCategories,
} from "@/lib/medusa-product-categories";
import {
  createWorkerProductCategoryForAdmin,
  fetchWorkerProductCategoriesForAdmin,
} from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

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
  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return correlatedError(correlationId, 413, "Payload too large", "VALIDATION_ERROR");
  const body = (parsedBody.valid ? parsedBody.value : {}) as {
    name?: string;
    handle?: string;
  };
  if (process.env.API_URL?.trim()) {
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) return correlatedError(correlationId, 400, "Idempotency-Key is required", "BAD_REQUEST");
    const response = await createWorkerProductCategoryForAdmin({
      name: typeof body.name === "string" ? body.name : "",
      handle: typeof body.handle === "string" ? body.handle : undefined,
      idempotencyKey,
    });
    if (!response) return correlatedError(correlationId, 503, "Commerce Worker is unavailable", "SERVICE_UNAVAILABLE");
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof payload.error === "string" ? payload.error : "Category creation failed";
      return correlatedError(correlationId, response.status, message, response.status === 409 ? "CONFLICT" : "VALIDATION_ERROR");
    }
    return correlatedJson(correlationId, payload, { status: response.status });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const handle = typeof body.handle === "string" ? body.handle : undefined;
  const result = await createAdminProductCategory({ name, handle });
  if (!result.ok) {
    return correlatedError(correlationId, 400, result.message, "VALIDATION_ERROR");
  }
  return correlatedJson(correlationId, { category: result.category }, { status: 201 });
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
    return correlatedJson(correlationId, { categories });
  }

  const categories = await listAdminProductCategories();
  return correlatedJson(correlationId, { categories });
}

export const POST = withAdminMutationIdempotency("/admin/catalog/categories:POST", post);
