import { NextResponse } from "next/server";
import { readResponseJson } from "@/lib/read-response-json";
import { checkoutIntentRecoveryResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const providerParam =
    typeof searchParams.get("provider") === "string"
      ? searchParams.get("provider")!.trim().toLowerCase()
      : "stripe";
  const supportedProviders = ["stripe", "paypal", "xendit"] as const;
  if (!supportedProviders.includes(providerParam as (typeof supportedProviders)[number])) {
    return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
  }
  const provider = providerParam as "stripe" | "paypal" | "xendit";
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerBaseUrl) {
    return NextResponse.json({ error: "Payment service is not configured" }, { status: 503 });
  }
  const workerUrl = new URL(`${workerBaseUrl}/store/checkout-intents/recover`);
  workerUrl.searchParams.set("provider", provider);
  const providerOrderId = searchParams.get("provider_order_id")?.trim();
  if (providerOrderId) workerUrl.searchParams.set("provider_order_id", providerOrderId);
  let response: Response;
  try {
    response = await fetch(workerUrl, {
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(req.headers.get("cookie") ? { Cookie: req.headers.get("cookie")! } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Payment service is unavailable" }, { status: 503 });
  }
  const payload = await readResponseJson(response, { error: "Unable to recover payment status" });
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }
  const parsed = checkoutIntentRecoveryResponseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment recovery response" }, { status: 502 });
  return NextResponse.json(parsed.data, { status: 200 });
}
