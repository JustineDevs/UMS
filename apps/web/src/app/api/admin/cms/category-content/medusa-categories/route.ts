import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { listAdminProductCategories } from "@/lib/medusa-product-categories";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

/**
 * Product categories for CMS category storytelling (handles must match shop filters).
 * Uses content:read so editors without catalog:read can still pick a valid handle.
 */
export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:read")) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }
  const categories = await listAdminProductCategories();
  return correlatedJson(correlationId, {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
    })),
  });
}
