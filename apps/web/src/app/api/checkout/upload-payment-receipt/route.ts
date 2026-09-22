import { NextRequest, NextResponse } from "next/server";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { proxyWorkerStorefrontRoute } from "@/lib/worker-storefront-route-proxy";
import { paymentReceiptUploadResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";
const MAX_MULTIPART_BODY_BYTES = 5 * 1024 * 1024 + 256 * 1024;

async function handlePOST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const rl = await rateLimitFixedWindow(`upload-payment-receipt:${getRequestIp(req)}`, 6, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests", retryAfter: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const contentLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) return NextResponse.json({ error: "Receipt upload is too large" }, { status: 413 });
  return proxyWorkerStorefrontRoute(req, "/store/checkout/upload-payment-receipt", MAX_MULTIPART_BODY_BYTES, paymentReceiptUploadResponseSchema);
}

export const POST = withBotIdProtection(handlePOST);
