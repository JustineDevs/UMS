import { NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readResponseJson } from "@/lib/read-response-json";
import { paypalConfirmationResponseSchema } from "@/lib/admin-api-contracts";

type ConfirmBody = { correlationId?: unknown; orderId?: unknown };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const parsed = await parseJsonBody<ConfirmBody>(req);
  if (!parsed.ok) return parsed.response;
  const correlationId = typeof parsed.data.correlationId === "string" ? parsed.data.correlationId.trim() : "";
  const orderId = typeof parsed.data.orderId === "string" ? parsed.data.orderId.trim() : "";
  if (!correlationId || !orderId) {
    return NextResponse.json({ error: "PayPal confirmation identifiers are required" }, { status: 400 });
  }

  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerBaseUrl) {
    return NextResponse.json({ error: "PayPal confirmation service is not configured" }, { status: 503 });
  }
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || `paypal-confirm:${correlationId}:${orderId}`;
  let response: Response;
  try {
    response = await fetch(`${workerBaseUrl}/store/checkout/paypal/confirm`, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        ...(req.headers.get("Cookie") ? { Cookie: req.headers.get("Cookie") as string } : {}),
      },
      body: JSON.stringify({ correlationId, orderId }),
    });
  } catch {
    return NextResponse.json({ error: "PayPal confirmation service is unavailable" }, { status: 503 });
  }
  const body = await readResponseJson(response, { error: "PayPal confirmation failed" });
  if (!response.ok) {
    return NextResponse.json(body, { status: response.status >= 500 ? 502 : response.status });
  }
  const result = { ok: true as const, provider: body };
  const parsedResult = paypalConfirmationResponseSchema.safeParse(result);
  if (!parsedResult.success) return NextResponse.json({ error: "PayPal confirmation returned an invalid response" }, { status: 502 });
  return NextResponse.json(parsedResult.data);
}
