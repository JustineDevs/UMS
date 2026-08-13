import { NextRequest } from "next/server";
import { POS_FEATURE_MAPPINGS } from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import {
  isPancakeConfigured,
  listPancakeResource,
  listPancakeShops,
  PancakeApiError,
  type PancakeResource,
} from "@/lib/pancake-client";

const RESOURCES = new Set<PancakeResource>([
  "orders", "customers", "products", "warehouses", "inventory_histories",
  "order_source", "order_tags", "e_invoices", "employees", "analytics_sale",
]);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);

  const resource = req.nextUrl.searchParams.get("resource") ?? "shops";
  if (!isPancakeConfigured()) {
    return correlatedJson(correlationId, {
      configured: false,
      provider: "pancake_pos",
      resource,
      data: resource === "feature-mappings" ? POS_FEATURE_MAPPINGS : [],
      message: "Connect Pancake by setting PANCAKE_POS_API_KEY on the admin server.",
    });
  }

  try {
    if (resource === "feature-mappings") {
      return correlatedJson(correlationId, { configured: true, provider: "pancake_pos", resource, data: POS_FEATURE_MAPPINGS });
    }
    if (resource === "shops") {
      return correlatedJson(correlationId, { configured: true, provider: "pancake_pos", resource, data: await listPancakeShops() });
    }
    if (!RESOURCES.has(resource as PancakeResource)) {
      return correlatedError(correlationId, 400, "Unsupported Pancake resource", "BAD_REQUEST");
    }
    const shopId = req.nextUrl.searchParams.get("shopId")?.trim();
    if (!shopId) return correlatedError(correlationId, 400, "shopId is required", "BAD_REQUEST");
    const data = await listPancakeResource(resource as PancakeResource, shopId, req.nextUrl.searchParams);
    return correlatedJson(correlationId, { configured: true, provider: "pancake_pos", resource, shopId, data });
  } catch (error) {
    const status = error instanceof PancakeApiError ? error.status : 502;
    return correlatedError(correlationId, status === 503 ? 503 : 502, error instanceof Error ? error.message : "Pancake request failed", status === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR");
  }
}
