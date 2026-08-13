import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CMS_FORM_KEYS,
  getCmsFormSettings,
  insertCmsFormSubmission,
} from "@universal-music-store/platform-data";
import { cmsFormSubmissionPayloadSchema } from "@universal-music-store/validation";

import {
  createStorefrontAnonSupabase,
  createStorefrontServiceSupabase,
} from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";

type ContactFormRouteDeps = {
  createAnonSupabase?: () => SupabaseClient | null;
  createServiceSupabase?: () => SupabaseClient | null;
  getIp?: (req: NextRequest) => string;
  rateLimit?: typeof rateLimitFixedWindow;
  insertSubmission?: typeof insertCmsFormSubmission;
  getSettings?: typeof getCmsFormSettings;
  fetchImpl?: typeof fetch;
  nowIso?: () => string;
};

const defaultDeps: Required<ContactFormRouteDeps> = {
  createAnonSupabase: createStorefrontAnonSupabase,
  createServiceSupabase: createStorefrontServiceSupabase,
  getIp: getRequestIp,
  rateLimit: rateLimitFixedWindow,
  insertSubmission: insertCmsFormSubmission,
  getSettings: getCmsFormSettings,
  fetchImpl: fetch,
  nowIso: () => new Date().toISOString(),
};

function pickWriteClient(deps: Required<ContactFormRouteDeps>) {
  return deps.createServiceSupabase() ?? deps.createAnonSupabase();
}

export async function handleCmsFormSubmissionRequest(
  req: NextRequest,
  formKey: string,
  deps: ContactFormRouteDeps = {},
) {
  const merged = { ...defaultDeps, ...deps } satisfies Required<ContactFormRouteDeps>;

  const ip = merged.getIp(req);
  const rl = await merged.rateLimit(`cms-form:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  if (!CMS_FORM_KEYS.includes(formKey as (typeof CMS_FORM_KEYS)[number])) {
    return Response.json({ error: "Unknown form" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payloadParsed = cmsFormSubmissionPayloadSchema.safeParse(body);
  if (!payloadParsed.success) {
    return Response.json(
      { error: "Invalid form payload", details: payloadParsed.error.flatten() },
      { status: 400 },
    );
  }

  const raw = payloadParsed.data as Record<string, unknown>;
  const trap = raw._hp ?? raw._honeypot;
  if (trap != null && String(trap).trim() !== "") {
    return Response.json({ ok: true });
  }

  const payload = { ...raw };
  delete payload._hp;
  delete payload._honeypot;

  const writeClient = pickWriteClient(merged);
  if (!writeClient) {
    return Response.json(
      { error: "Contact submissions are temporarily unavailable" },
      { status: 503 },
    );
  }

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const submissionId = await merged.insertSubmission(writeClient, {
    form_key: formKey,
    payload,
    ip_hash: ipHash,
  });
  if (!submissionId) {
    return Response.json(
      {
        error:
          "We could not save your message. Please try again or use the support email and phone shown on the page.",
      },
      { status: 503 },
    );
  }

  const svc = merged.createServiceSupabase();
  if (svc) {
    const settings = await merged.getSettings(svc);
    const wh = settings?.webhook_url?.trim();
    if (wh) {
      const hookBody = JSON.stringify({
        event: "cms_form_submission",
        form_key: formKey,
        submission_id: submissionId,
        payload,
        created_at: merged.nowIso(),
      });
      void merged.fetchImpl(wh, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: hookBody,
      }).catch(() => {});
    }
  }

  return Response.json({ ok: true, id: submissionId });
}
