import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStorefrontSession } from "@/lib/auth";
import crypto from "node:crypto";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { fetchCustomerOrders } from "@/lib/medusa-account-orders";
import { matchesReceiptSignature } from "@/lib/payment-receipt-signature";
import { resolvePaymentReceiptOrganizationId } from "@/lib/payment-receipt-organization";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_MULTIPART_BODY_BYTES = MAX_FILE_SIZE_BYTES + 256 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * POST /api/checkout/upload-payment-receipt
 *
 * Accepts a multipart form with:
 *   - `orderId`: the Medusa order ID
 *   - `receipt`: the image/pdf file
 *
 * Stores the file in Supabase Storage bucket `payment-receipts` and inserts
 * a row into `payment_receipts` table for admin review.
 *
 * Returns a short-lived signed URL; the stored object is never public.
 */
async function handlePOST(req: NextRequest) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`upload-payment-receipt:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const session = await getStorefrontSession();
  const userId: string | null =
    ((session?.user as Record<string, unknown> | undefined)?.id as string | undefined) ?? null;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!session?.user || !userId || !email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) {
    return NextResponse.json({ error: "Receipt upload is too large" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const orderId = typeof formData.get("orderId") === "string"
    ? (formData.get("orderId") as string).trim()
    : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const customerOrders = await fetchCustomerOrders(email);
  if (!customerOrders.orders.some((order) => order.id === orderId)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: paymentAttempt } = await createClient(supabaseUrl, supabaseKey)
    .from("payment_attempts")
    .select("id,organization_id,customer_email")
    .eq("medusa_order_id", orderId)
    .eq("customer_email", email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const organizationId = resolvePaymentReceiptOrganizationId({
    paymentAttemptOrganizationId:
      typeof paymentAttempt?.organization_id === "string" ? paymentAttempt.organization_id : null,
    configuredOrganizationId: process.env.DEFAULT_ORGANIZATION_ID,
  });
  if (!organizationId) {
    return NextResponse.json({ error: "Store organization is not configured" }, { status: 503 });
  }

  const file = formData.get("receipt");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "receipt file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be under 5 MB" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, or PDF files are accepted" },
      { status: 400 },
    );
  }

  const ext = mimeType === "application/pdf" ? "pdf"
    : mimeType === "image/png" ? "png"
    : mimeType === "image/webp" ? "webp"
    : "jpg";

  const fileId = crypto.randomUUID();
  const storagePath = `${orderId}/${fileId}.${ext}`;

  const sb = createClient(supabaseUrl, supabaseKey);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!matchesReceiptSignature(mimeType, buffer)) {
    return NextResponse.json({ error: "Receipt contents do not match the declared file type" }, { status: 400 });
  }

  const { error: uploadError } = await sb.storage
    .from("payment-receipts")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload-payment-receipt] storage upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 503 });
  }

  const { data: row, error: dbError } = await sb
    .from("payment_receipts")
    .insert({
      order_id: orderId,
      user_id: userId,
      organization_id: organizationId,
      payment_attempt_id: paymentAttempt?.id ?? null,
      customer_email: email,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: file.size,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("[upload-payment-receipt] db insert error:", dbError);
    await sb.storage.from("payment-receipts").remove([storagePath]);
    return NextResponse.json({ error: "Failed to record receipt. Contact support." }, { status: 503 });
  }

  const { data: signedUrl, error: signedUrlError } = await sb.storage
    .from("payment-receipts")
    .createSignedUrl(storagePath, 300);
  if (signedUrlError || !signedUrl?.signedUrl) {
    console.error("[upload-payment-receipt] signed URL error:", signedUrlError);
    return NextResponse.json({ error: "Receipt uploaded; preview is temporarily unavailable." }, { status: 202 });
  }

  return NextResponse.json({
    ok: true,
    receiptId: row?.id ?? fileId,
    url: signedUrl.signedUrl,
  });
}

export const POST = withBotIdProtection(handlePOST);
