import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CmsRedirectRow = {
  id: string;
  from_path: string;
  to_path: string;
  status_code: 301 | 302 | 307 | 308;
  active: boolean;
  preserve_query: boolean;
  created_at: string;
};

export async function listCmsRedirects(supabase: SupabaseClient, organizationId?: string): Promise<CmsRedirectRow[]> {
  let query = supabase.from("cms_redirects").select("*").order("from_path");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-redirects] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    const code = Number(x.status_code) || 301;
    return {
      id: String(x.id),
      from_path: String(x.from_path ?? ""),
      to_path: String(x.to_path ?? ""),
      status_code: ([301, 302, 307, 308] as const).includes(code as 301)
        ? (code as 301 | 302 | 307 | 308)
        : 301,
      active: Boolean(x.active),
      preserve_query: Boolean(x.preserve_query),
      created_at: String(x.created_at ?? ""),
    };
  });
}

export async function upsertCmsRedirect(
  supabase: SupabaseClient,
  input: {
    id?: string;
    from_path: string;
    to_path: string;
    status_code?: 301 | 302 | 307 | 308;
    active?: boolean;
    preserve_query?: boolean;
    organization_id?: string;
  },
): Promise<CmsRedirectRow | null> {
  const row = {
    from_path: input.from_path,
    to_path: input.to_path,
    status_code: input.status_code ?? 301,
    active: input.active ?? true,
    preserve_query: input.preserve_query ?? false,
    organization_id: input.organization_id ?? null,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("cms_redirects")
      .update(row)
      .eq("id", input.id)
      .eq("organization_id", input.organization_id ?? "")
      .select("*")
      .single();
    if (error) {
      console.error("[cms-redirects] update", error.message);
      return null;
    }
    const x = data as Record<string, unknown>;
    return {
      id: String(x.id),
      from_path: String(x.from_path ?? ""),
      to_path: String(x.to_path ?? ""),
      status_code: Number(x.status_code) as 301 | 302 | 307 | 308,
      active: Boolean(x.active),
      preserve_query: Boolean(x.preserve_query),
      created_at: String(x.created_at ?? ""),
    };
  }
  const { data, error } = await supabase.from("cms_redirects").insert(row).select("*").single();
  if (error) {
    console.error("[cms-redirects] insert", error.message);
    return null;
  }
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    from_path: String(x.from_path ?? ""),
    to_path: String(x.to_path ?? ""),
    status_code: Number(x.status_code) as 301 | 302 | 307 | 308,
    active: Boolean(x.active),
    preserve_query: Boolean(x.preserve_query),
    created_at: String(x.created_at ?? ""),
  };
}

export async function deleteCmsRedirect(
  supabase: SupabaseClient,
  id: string,
  organizationId?: string,
): Promise<boolean> {
  let query = supabase.from("cms_redirects").delete().eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { error } = await query;
  if (error) {
    console.error("[cms-redirects] delete", error.message);
    return false;
  }
  return true;
}

export async function getCmsRedirectForPath(
  supabase: SupabaseClient,
  fromPath: string,
  organizationId?: string,
): Promise<CmsRedirectRow | null> {
  const normalized = fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
  let query = supabase
    .from("cms_redirects")
    .select("*")
    .eq("from_path", normalized)
    .eq("active", true);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-redirects] getForPath", error.message);
    return null;
  }
  if (!data) return null;
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    from_path: String(x.from_path ?? ""),
    to_path: String(x.to_path ?? ""),
    status_code: Number(x.status_code) as 301 | 302 | 307 | 308,
    active: Boolean(x.active),
    preserve_query: Boolean(x.preserve_query),
    created_at: String(x.created_at ?? ""),
  };
}
