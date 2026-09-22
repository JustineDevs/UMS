import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/** Permanently retired: checkout completion is owned by the Worker payment-attempt contract. */
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      {
        status: 403,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  return NextResponse.json(
    {
      error:
        "Legacy cart completion is disabled. Use POST /api/payments/checkout-intents/:correlationId/finalize.",
      code: "LEGACY_ROUTE_DISABLED",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}
