import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import type { StorefrontShippingAddress } from "@universal-music-store/validation";

export type ServerCustomerProfile = {
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  shippingAddresses: StorefrontShippingAddress[];
};

export async function loadCustomerProfile(
  email: string,
): Promise<ServerCustomerProfile | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const sb = createStorefrontServiceSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("storefront_customer_profiles")
    .select("display_name,phone,avatar_url,shipping_addresses")
    .eq("email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  const raw = data as {
    display_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    shipping_addresses?: unknown;
  };
  let shippingAddresses: StorefrontShippingAddress[] = [];
  if (Array.isArray(raw.shipping_addresses)) {
    shippingAddresses = raw.shipping_addresses.filter(
      (x): x is StorefrontShippingAddress =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as StorefrontShippingAddress).fullName === "string",
    );
  }
  return {
    displayName:
      typeof raw.display_name === "string" ? raw.display_name : null,
    phone: typeof raw.phone === "string" ? raw.phone : null,
    avatarUrl: typeof raw.avatar_url === "string" ? raw.avatar_url : null,
    shippingAddresses,
  };
}
