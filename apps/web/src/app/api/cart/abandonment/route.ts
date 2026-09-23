import { NextRequest, NextResponse } from "next/server";
import { verifyBotIdProtection } from "@/lib/botid-protection";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { isSameOriginMutation } from "@/lib/request-origin";
import { proxyWorkerStorefrontRoute } from "@/lib/worker-storefront-route-proxy";
import { simpleOkResponseSchema } from "@/lib/admin-api-contracts";

const MAX_BODY_BYTES = 64 * 1024;

async function handlePOST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const rl = await applyRateLimit(req, "cart-abandon", 80, 3_600_000);
  if (!rl.ok) return rl.response;
  const bounded = await parseBoundedJson(req.clone(), MAX_BODY_BYTES);
  if (bounded.tooLarge) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!bounded.valid) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const botProtectionFailure = await verifyBotIdProtection();
  if (botProtectionFailure) return botProtectionFailure;
  return proxyWorkerStorefrontRoute(req, "/store/cart/abandonment", MAX_BODY_BYTES, simpleOkResponseSchema);
}

export const POST = handlePOST;
