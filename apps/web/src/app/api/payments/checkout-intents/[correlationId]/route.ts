import { NextResponse } from "next/server";
import { readResponseJson } from "@/lib/read-response-json";
import { checkoutIntentResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ correlationId: string }> },
) {
  const { correlationId } = await ctx.params;
  if (!correlationId?.trim()) {
    return NextResponse.json({ error: "Missing correlation id" }, { status: 400 });
  }

  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerBaseUrl) {
    return NextResponse.json({ error: "Payment service is not configured" }, { status: 503 });
  }
  let response: Response;
  try {
    response = await fetch(
      `${workerBaseUrl}/store/checkout-intents/${encodeURIComponent(correlationId.trim())}`,
      {
        cache: "no-store",
        redirect: "error",
        headers: {
          Accept: "application/json",
          ...(req.headers.get("cookie") ? { Cookie: req.headers.get("cookie")! } : {}),
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Payment service is unavailable" }, { status: 503 });
  }
  const payload = await readResponseJson(response, { error: "Not found" });
  if (!response.ok) return NextResponse.json(payload, { status: response.status });
  const parsed = checkoutIntentResponseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment intent response" }, { status: 502 });
  return NextResponse.json(parsed.data, { status: 200 });
}
