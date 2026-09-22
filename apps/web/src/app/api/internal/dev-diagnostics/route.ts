import { NextResponse } from "next/server";
import { collectDevRuntimeDiagnostics } from "@/lib/dev-runtime-diagnostics";
import { devDiagnosticsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuredSecret = process.env.STOREFRONT_INTERNAL_DIAGNOSTICS_SECRET?.trim();
  const providedSecret = request.headers.get("x-internal-secret")?.trim();
  if (process.env.NODE_ENV === "production" || process.env.UVS_DEV_DIAGNOSTICS !== "1" || !configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const diagnostics = await collectDevRuntimeDiagnostics();
  const payload = devDiagnosticsResponseSchema.parse({ diagnostics });
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
