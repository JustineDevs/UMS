import type { WorkerDatabaseClient } from "./database.ts";
import { sendResendEmail } from "./resend.ts";

const MAX_BODY_BYTES = 64 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Env = { AUTH_SECRET?: string; STOREFRONT_CART_RECOVERY_EMAIL?: string; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; NEXT_PUBLIC_SITE_URL?: string; TRACKING_HMAC_SECRET?: string; TRACKING_HMAC_KEY_VERSION?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function cookie(request: Request, name: string): string | null { return request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1)?.trim() || null; }
function base64(bytes: Uint8Array): string { let raw = ""; for (const byte of bytes) raw += String.fromCharCode(byte); return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function capability(id: string, secret: string | undefined): Promise<string | null> {
  if (!id || !secret) return null;
  const now = Math.floor(Date.now() / 1000); const expires = now + 7 * 24 * 60 * 60; const version = "v1";
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({ version: "v3", purpose: "track", audience: "public-tracking", keyVersion: version, id, issuedAt: now, expiresAt: expires });
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload)));
  return ["v3", version, String(now), String(expires), base64(iv), base64(encrypted.slice(-16)), base64(encrypted.slice(0, -16))].join(".");
}
async function signatureValid(body: ArrayBuffer, supplied: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !supplied) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  return base64(digest) === supplied;
}

export async function handleCartAbandonmentRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const length = Number(request.headers.get("content-length") ?? "0"); if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  let input: Record<string, unknown>; try { const raw = await request.arrayBuffer(); if (raw.byteLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413); if (!(await signatureValid(raw, request.headers.get("x-storefront-signature"), env.AUTH_SECRET))) return json({ error: "Invalid storefront signature" }, 401); const value = JSON.parse(new TextDecoder().decode(raw)); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); input = value as Record<string, unknown>; } catch (error) { if (error instanceof Response) return error; return json({ error: "Invalid payload" }, 400); }
  const rawEmail = typeof input.email === "string" ? input.email.trim().slice(0, 320).toLowerCase() : "";
  const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : null;
  const lineCount = Array.isArray(input.lines) ? Math.min(input.lines.length, 50) : 0;
  const text = (value: unknown) => typeof value === "string" ? value.slice(0, 2000) : null;
  const inserted = await database.query<{ id: string }>("INSERT INTO public.cart_abandonment_events (email,line_count,path,referrer,client_timestamp) VALUES ($1,$2,$3,$4,$5) RETURNING id", [email, lineCount, text(input.path), text(input.referrer), text(input.clientTimestamp)]);
  if (!inserted.rows[0]?.id) return json({ error: "Unable to record" }, 503);
  if (env.STOREFRONT_CART_RECOVERY_EMAIL === "1" && email && lineCount > 0 && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    const day = new Date().toISOString().slice(0, 10);
    const dedup = await database.query("INSERT INTO public.cart_recovery_send_log (email,window_day) VALUES ($1,$2) ON CONFLICT DO NOTHING", [email, day]);
    if (dedup.rowCount === 1) {
      const cartId = cookie(request, "mcart_id"); const origin = (env.NEXT_PUBLIC_SITE_URL || "https://universalmusic.vercel.app").replace(/\/$/, ""); const token = cartId ? await capability(cartId, env.TRACKING_HMAC_SECRET) : null; const resumeUrl = token ? `${origin}/checkout?token=${encodeURIComponent(token)}` : `${origin}/checkout`;
      const sent = await sendResendEmail({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL, to: [email], subject: "You left items in your bag", html: `<p>You still have <strong>${lineCount}</strong> line item${lineCount === 1 ? "" : "s"} in your bag.</p><p><a href="${resumeUrl}">Return to checkout</a> when you are ready.</p>`, idempotencyKey: `cart-recovery:${email}:${day}` });
      if (sent.ok) await database.query("UPDATE public.cart_abandonment_events SET recovery_email_sent_at=now() WHERE id=$1", [inserted.rows[0].id]);
    }
  }
  return json({ ok: true });
}
