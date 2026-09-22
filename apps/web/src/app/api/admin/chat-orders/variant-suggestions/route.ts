import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { searchCatalogVariantLines } from "@/lib/chat-order-catalog-search";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { adminChatOrderVariantSuggestionsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "chat_orders:manage")) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const result = await searchCatalogVariantLines(q, 12);
  if ("unavailable" in result) {
    return correlatedError(correlationId, 503, "Catalog search is temporarily unavailable", "SERVICE_UNAVAILABLE");
  }
  const parsed = adminChatOrderVariantSuggestionsResponseSchema.safeParse(result);
  if (!parsed.success) return correlatedJson(correlationId, { error: "Invalid catalog suggestion response" }, { status: 502 });
  return correlatedJson(correlationId, parsed.data);
}
