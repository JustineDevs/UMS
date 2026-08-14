import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export const CMS_FORM_KEYS = ["contact", "newsletter", "lead"] as const;
export type CmsFormKey = (typeof CMS_FORM_KEYS)[number];

export type CmsFormSubmissionRow = {
  id: string;
  form_key: string;
  payload: Record<string, unknown>;
  created_at: string;
  ip_hash: string | null;
  read_at: string | null;
  assigned_to: string | null;
  spam_score: number;
};

export type ListCmsFormSubmissionsOptions = {
  organization_id?: string;
  form_key?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type CmsFormSettingsRow = {
  id: string;
  webhook_url: string | null;
  notify_email: string | null;
  updated_at: string;
};

function mapSubmission(x: Record<string, unknown>): CmsFormSubmissionRow {
  return {
    id: String(x.id),
    form_key: String(x.form_key ?? ""),
    payload: (x.payload && typeof x.payload === "object" ? x.payload : {}) as Record<string, unknown>,
    created_at: String(x.created_at ?? ""),
    ip_hash: x.ip_hash != null ? String(x.ip_hash) : null,
    read_at: x.read_at != null ? String(x.read_at) : null,
    assigned_to: x.assigned_to != null ? String(x.assigned_to) : null,
    spam_score: typeof x.spam_score === "number" ? x.spam_score : Number(x.spam_score) || 0,
  };
}

export async function listCmsFormSubmissions(
  supabase: SupabaseClient,
  limitOrOpts: number | ListCmsFormSubmissionsOptions = 200,
): Promise<CmsFormSubmissionRow[] | { rows: CmsFormSubmissionRow[]; total: number }> {
  if (typeof limitOrOpts === "number") {
    const { data, error } = await supabase
      .from("cms_form_submissions")
      .select("id, form_key, payload, created_at, ip_hash, read_at, assigned_to, spam_score")
      .order("created_at", { ascending: false })
      .limit(limitOrOpts);
    if (error) {
      if (isMissingTableOrSchemaError(error)) return [];
      console.error("[cms-forms] list", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapSubmission(r as Record<string, unknown>));
  }

  const opts = limitOrOpts;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  let countQ = supabase
    .from("cms_form_submissions")
    .select("id", { count: "exact", head: true });
  let dataQ = supabase
    .from("cms_form_submissions")
    .select("id, form_key, payload, created_at, ip_hash, read_at, assigned_to, spam_score")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.organization_id) {
    countQ = countQ.eq("organization_id", opts.organization_id);
    dataQ = dataQ.eq("organization_id", opts.organization_id);
  }

  if (opts.form_key?.trim()) {
    const fk = opts.form_key.trim();
    countQ = countQ.eq("form_key", fk);
    dataQ = dataQ.eq("form_key", fk);
  }
  if (opts.from?.trim()) {
    countQ = countQ.gte("created_at", opts.from.trim());
    dataQ = dataQ.gte("created_at", opts.from.trim());
  }
  if (opts.to?.trim()) {
    countQ = countQ.lte("created_at", opts.to.trim());
    dataQ = dataQ.lte("created_at", opts.to.trim());
  }

  const [{ count, error: cErr }, { data, error: dErr }] = await Promise.all([countQ, dataQ]);
  if (cErr || dErr) {
    const err = cErr ?? dErr;
    if (isMissingTableOrSchemaError(err!)) return { rows: [], total: 0 };
    console.error("[cms-forms] list paged", err?.message);
    return { rows: [], total: 0 };
  }
  return {
    rows: (data ?? []).map((r) => mapSubmission(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function updateCmsFormSubmission(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<CmsFormSubmissionRow, "read_at" | "assigned_to" | "spam_score">>,
  organizationId?: string,
): Promise<CmsFormSubmissionRow | null> {
  const payload: Record<string, unknown> = {};
  if (patch.read_at !== undefined) payload.read_at = patch.read_at;
  if (patch.assigned_to !== undefined) payload.assigned_to = patch.assigned_to;
  if (patch.spam_score !== undefined) payload.spam_score = patch.spam_score;
  if (Object.keys(payload).length === 0) {
    const { data } = await supabase
      .from("cms_form_submissions")
      .select("id, form_key, payload, created_at, ip_hash, read_at, assigned_to, spam_score")
      .eq("id", id)
      .eq("organization_id", organizationId ?? "")
      .maybeSingle();
    return data ? mapSubmission(data as Record<string, unknown>) : null;
  }
  const { data, error } = await supabase
    .from("cms_form_submissions")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organizationId ?? "")
    .select("id, form_key, payload, created_at, ip_hash, read_at, assigned_to, spam_score")
    .single();
  if (error) {
    console.error("[cms-forms] update", error.message);
    return null;
  }
  return mapSubmission(data as Record<string, unknown>);
}

export async function getCmsFormSettings(supabase: SupabaseClient, organizationId?: string): Promise<CmsFormSettingsRow | null> {
  let query = supabase.from("cms_form_settings").select("*").eq("id", "default");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-forms] get settings", error.message);
    return null;
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id ?? "default"),
    webhook_url: r.webhook_url != null ? String(r.webhook_url) : null,
    notify_email: r.notify_email != null ? String(r.notify_email) : null,
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function upsertCmsFormSettings(
  supabase: SupabaseClient,
  input: Partial<Pick<CmsFormSettingsRow, "webhook_url" | "notify_email">>,
  organizationId?: string,
): Promise<CmsFormSettingsRow | null> {
  const existing = await getCmsFormSettings(supabase, organizationId);
  const row = {
    id: "default",
    webhook_url:
      input.webhook_url !== undefined ? input.webhook_url : existing?.webhook_url ?? null,
    notify_email:
      input.notify_email !== undefined ? input.notify_email : existing?.notify_email ?? null,
    updated_at: new Date().toISOString(),
    organization_id: organizationId ?? null,
  };
  const { data, error } = await supabase.from("cms_form_settings").upsert(row, { onConflict: "organization_id,id" }).select("*").single();
  if (error) {
    console.error("[cms-forms] upsert settings", error.message);
    return null;
  }
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id ?? "default"),
    webhook_url: r.webhook_url != null ? String(r.webhook_url) : null,
    notify_email: r.notify_email != null ? String(r.notify_email) : null,
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function insertCmsFormSubmission(
  supabase: SupabaseClient,
  input: { form_key: CmsFormKey | string; payload: Record<string, unknown>; ip_hash?: string | null; organization_id?: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cms_form_submissions")
    .insert({
      form_key: input.form_key,
      payload: input.payload,
      ip_hash: input.ip_hash ?? null,
      created_at: new Date().toISOString(),
      organization_id: input.organization_id ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[cms-forms] insert", error.message);
    return null;
  }
  const id = (data as { id?: string } | null)?.id;
  return id ? String(id) : null;
}
