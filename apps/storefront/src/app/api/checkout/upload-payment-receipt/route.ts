import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import crypto from "node:crypto";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
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
 * Returns: { ok: true, receiptId: string, publicUrl: string }
 */
async function handlePOST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`upload-payment-receipt:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  const userId: string | null =
    ((session?.user as Record<string, unknown> | undefined)?.id as string | undefined) ?? null;

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

  const { data: urlData } = sb.storage
    .from("payment-receipts")
    .getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl ?? "";

  const { data: row, error: dbError } = await sb
    .from("payment_receipts")
    .insert({
      order_id: orderId,
      user_id: userId,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mimeType,
      file_size_bytes: file.size,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("[upload-payment-receipt] db insert error:", dbError);
    return NextResponse.json({ error: "Failed to record receipt. Contact support." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    receiptId: row?.id ?? fileId,
    publicUrl,
  });
}

export const POST = withBotIdProtection(handlePOST);
