import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
  }
  if (
    !staffSessionAllows(session, "catalog:read") &&
    !staffSessionAllows(session, "catalog:write")
  ) {
    return correlatedError(correlationId, 403, "Forbidden", "FORBIDDEN");
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const path = `/admin/products?limit=30${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  try {
    const res = await medusaAdminFetch(path);
    const json = (await res.json()) as {
      products?: Array<{
        id?: string;
        title?: string;
        handle?: string;
      }>;
      message?: string;
    };
    if (!res.ok) {
      return correlatedError(
        correlationId,
        res.status,
        "Store catalog request failed",
        res.status >= 500 ? "SERVICE_UNAVAILABLE" : "VALIDATION_ERROR",
      );
    }
    const items = (json.products ?? [])
      .map((p) => ({
        id: String(p.id ?? ""),
        title: String(p.title ?? "").trim() || "(untitled)",
        handle: String(p.handle ?? "").trim(),
      }))
      .filter((p) => p.id && p.handle);
    return correlatedJson(correlationId, { items });
  } catch (e) {
    return correlatedError(correlationId, 502, "Store catalog request unavailable", "SERVICE_UNAVAILABLE");
  }
}
