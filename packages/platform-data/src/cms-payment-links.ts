import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CmsPaymentLinkRow = {
  id: string;
  title: string;
  provider: string;
  payment_url: string;
  description: string;
  locale: string;
  cta_label: string;
  active: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function rowToPaymentLink(r: Record<string, unknown>): CmsPaymentLinkRow {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    provider: String(r.provider ?? "stripe"),
    payment_url: String(r.payment_url ?? ""),
    description: String(r.description ?? ""),
    locale: String(r.locale ?? "en"),
    cta_label: String(r.cta_label ?? "Pay now"),
    active: r.active === false ? false : true,
    sort_order: typeof r.sort_order === "number" ? r.sort_order : Number(r.sort_order) || 0,
    metadata:
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function listCmsPaymentLinks(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CmsPaymentLinkRow[]> {
  const { data, error } = await supabase
    .from("cms_payment_links")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-payment-links] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToPaymentLink(r as Record<string, unknown>));
}

export async function getCmsPaymentLinkById(
  supabase: SupabaseClient,
  id: string,
  organizationId: string,
): Promise<CmsPaymentLinkRow | null> {
  const { data, error } = await supabase
    .from("cms_payment_links")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-payment-links] get", error.message);
    return null;
  }
  if (!data) return null;
  return rowToPaymentLink(data as Record<string, unknown>);
}

export type UpsertCmsPaymentLinkInput = {
  organizationId: string;
  id?: string;
  title?: string;
  provider?: string;
  payment_url?: string;
  description?: string;
  locale?: string;
  cta_label?: string;
  active?: boolean;
  sort_order?: number;
  metadata?: Record<string, unknown> | null;
};

export async function upsertCmsPaymentLink(
  supabase: SupabaseClient,
  input: UpsertCmsPaymentLinkInput,
): Promise<CmsPaymentLinkRow | null> {
  const existing = input.id
    ? await getCmsPaymentLinkById(supabase, input.id, input.organizationId)
    : null;
  const title = input.title ?? existing?.title ?? "";
  const paymentUrl = input.payment_url ?? existing?.payment_url ?? "";
  if (!title.trim() || !paymentUrl.trim()) {
    console.error("[cms-payment-links] upsert requires title and payment_url");
    return null;
  }

  const row = {
    title: title.trim(),
    provider: (input.provider ?? existing?.provider ?? "stripe").trim() || "stripe",
    payment_url: paymentUrl.trim(),
    description: input.description ?? existing?.description ?? "",
    locale: (input.locale ?? existing?.locale ?? "en").trim() || "en",
    cta_label: (input.cta_label ?? existing?.cta_label ?? "Pay now").trim() || "Pay now",
    active: input.active ?? existing?.active ?? true,
    sort_order:
      typeof input.sort_order === "number" ? input.sort_order : existing?.sort_order ?? 0,
    metadata: input.metadata !== undefined ? input.metadata : existing?.metadata ?? null,
    organization_id: input.organizationId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("cms_payment_links")
      .update(row)
      .eq("id", existing.id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    if (error) {
      console.error("[cms-payment-links] update", error.message);
      return null;
    }
    return rowToPaymentLink(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("cms_payment_links")
    .insert({
      ...row,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[cms-payment-links] insert", error.message);
    return null;
  }
  return rowToPaymentLink(data as Record<string, unknown>);
}

export async function deleteCmsPaymentLink(
  supabase: SupabaseClient,
  id: string,
  organizationId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("cms_payment_links")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) {
    console.error("[cms-payment-links] delete", error.message);
    return false;
  }
  return true;
}
