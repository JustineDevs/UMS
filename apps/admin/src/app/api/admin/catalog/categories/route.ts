import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  createAdminProductCategory,
  listAdminProductCategories,
} from "@/lib/medusa-product-categories";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

async function post(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "catalog:write")) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }
  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  const body = (parsedBody.valid ? parsedBody.value : {}) as {
    name?: string;
    handle?: string;
  };
  const name = typeof body.name === "string" ? body.name : "";
  const handle = typeof body.handle === "string" ? body.handle : undefined;
  const result = await createAdminProductCategory({ name, handle });
  if (!result.ok) {
    return correlatedJson(correlationId, { error: result.message }, { status: 400 });
  }
  return correlatedJson(correlationId, { category: result.category }, { status: 201 });
}

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "catalog:read")) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }

  const categories = await listAdminProductCategories();
  return correlatedJson(correlationId, { categories });
}

export const POST = withAdminMutationIdempotency("/admin/catalog/categories:POST", post);
