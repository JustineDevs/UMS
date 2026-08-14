import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const can =
    staffSessionAllows(session, "catalog:read") ||
    staffSessionAllows(session, "content:read") ||
    staffSessionAllows(session, "pos:use");
  if (!can) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const path = `/admin/products?limit=30${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    const res = await medusaAdminFetch(path);
    const json = (await res.json()) as unknown;
    if (!res.ok) {
      return correlatedJson(
        cid,
        { error: typeof json === "object" && json && "message" in json ? String((json as { message: unknown }).message) : res.statusText },
        { status: res.status },
      );
    }
    return correlatedJson(cid, { data: json });
  } catch (e) {
    return correlatedJson(
      cid,
      { error: e instanceof Error ? e.message : "Store catalog request unavailable" },
      { status: 502 },
    );
  }
}
