import { withBotIdProtection } from "@/lib/botid-protection";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit, parseJsonBody, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { buildCartAbandonmentRecord } from "@/lib/cart-abandonment";
import { buildCartRecoveryUrl, sendCartRecoveryEmail } from "@/lib/cart-recovery-email";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { isSameOriginMutation } from "@/lib/request-origin";

const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 80;

async function handlePOST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 64 * 1024) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  const rl = await applyRateLimit(req, "cart-abandon", MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) return rl.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (body === null || typeof body !== "object") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const record = buildCartAbandonmentRecord(body);
  if (!record) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const { email, lineCount, path, referrer, clientTimestamp } = record;

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return Response.json({ ok: false, skipped: true });
  }
  const { data: inserted, error } = await sb
    .from("cart_abandonment_events")
    .insert({
      email: email || null,
      line_count: lineCount,
      // Client prices are intentionally not persisted. Recovery and revenue
      // reporting must rehydrate current catalog/cart authority server-side.
      path,
      referrer,
      client_timestamp: clientTimestamp,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return Response.json({ error: "Unable to record" }, { status: 503 });
  }

  const rowId = String(inserted.id);
  const em = email ?? "";
  if (em && lineCount > 0) {
    const windowDay = new Date().toISOString().slice(0, 10);
    const normalizedEmail = em.toLowerCase();

    // Atomic dedup: insert into log table first. Unique constraint on
    // (email, window_day) prevents duplicate sends under concurrent requests.
    const { error: dedupError } = await sb
      .from("cart_recovery_send_log")
      .insert({ email: normalizedEmail, window_day: windowDay });

    if (!dedupError) {
      const cartId = await readCartIdFromCookie();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN).replace(/\/$/, "");
      const resumeUrl = cartId ? buildCartRecoveryUrl(origin, cartId) : null;
      const sent = await sendCartRecoveryEmail({
        to: em,
        lineCount,
        ...(resumeUrl ? { resumeUrl } : {}),
      });
      if (sent) {
        await sb
          .from("cart_abandonment_events")
          .update({ recovery_email_sent_at: new Date().toISOString() })
          .eq("id", rowId);
      }
    }
    // dedupError.code === "23505" means unique violation: already sent today, skip silently.
  }

  return Response.json({ ok: true });
}

export const POST = withBotIdProtection(handlePOST);
