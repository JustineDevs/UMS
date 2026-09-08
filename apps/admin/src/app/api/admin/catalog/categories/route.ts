import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  createAdminProductCategory,
  listAdminProductCategories,
} from "@/lib/medusa-product-categories";
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

  const categories = await listAdminProductCategories();
  return correlatedJson(correlationId, { categories });
}

export const POST = withAdminMutationIdempotency("/admin/catalog/categories:POST", post);
