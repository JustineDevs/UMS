import type { StorefrontShippingAddress } from "@universal-music-store/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ServerCustomerProfile = {
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  shippingAddresses: StorefrontShippingAddress[];
  updatedAt?: string | null;
};
export type CustomerProfileLoadResult = { profile: ServerCustomerProfile | null; unavailable: boolean };

function workerBaseUrl() { return process.env.API_URL?.trim().replace(/\/$/, "") || null; }
function mapProfile(value: unknown): ServerCustomerProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const rawAddresses = row.shipping_addresses;
  const shippingAddresses = Array.isArray(rawAddresses)
    ? rawAddresses.filter((item): item is StorefrontShippingAddress => Boolean(item && typeof item === "object" && typeof (item as { fullName?: unknown }).fullName === "string"))
    : [];
  return {
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    shippingAddresses,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function loadCustomerProfileResult(email: string): Promise<CustomerProfileLoadResult> {
  if (!email.trim()) return { profile: null, unavailable: false };
  const baseUrl = workerBaseUrl();
  if (!baseUrl) return { profile: null, unavailable: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (!token) return { profile: null, unavailable: false };
    const response = await fetch(`${baseUrl}/store/customers/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return { profile: null, unavailable: response.status >= 500 };
    const payload = await response.json().catch(() => null) as { profile?: unknown } | null;
    return { profile: mapProfile(payload?.profile), unavailable: false };
  } catch { return { profile: null, unavailable: true }; }
}

export async function loadCustomerProfile(email: string): Promise<ServerCustomerProfile | null> {
  return (await loadCustomerProfileResult(email)).profile;
}
