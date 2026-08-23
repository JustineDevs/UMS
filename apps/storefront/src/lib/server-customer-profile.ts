import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { findMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";
import type { StorefrontShippingAddress } from "@universal-music-store/validation";

export type ServerCustomerProfile = {
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  shippingAddresses: StorefrontShippingAddress[];
  updatedAt?: string | null;
};

export type CustomerProfileLoadResult = {
  profile: ServerCustomerProfile | null;
  unavailable: boolean;
};

export async function loadCustomerProfileResult(
  email: string,
): Promise<CustomerProfileLoadResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { profile: null, unavailable: false };
  const sb = createStorefrontServiceSupabase();
  if (!sb) return { profile: null, unavailable: true };
  const customerId = await findMedusaCustomerIdByEmail(normalized);
  const select = "display_name,phone,avatar_url,shipping_addresses,updated_at";
  const { data: byCustomer, error: customerError } = customerId
    ? await sb
        .from("storefront_customer_profiles")
        .select(select)
        .eq("medusa_customer_id", customerId)
        .maybeSingle()
    : { data: null, error: null };
  const { data, error } = byCustomer
    ? { data: byCustomer, error: customerError }
    : await sb
        .from("storefront_customer_profiles")
        .select(select)
        .eq("email", normalized)
        .maybeSingle();
  if (error) return { profile: null, unavailable: true };
  if (!data) return { profile: null, unavailable: false };
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
    unavailable: false,
    profile: {
      displayName:
        typeof raw.display_name === "string" ? raw.display_name : null,
      phone: typeof raw.phone === "string" ? raw.phone : null,
      avatarUrl: typeof raw.avatar_url === "string" ? raw.avatar_url : null,
      shippingAddresses,
      updatedAt: typeof (raw as { updated_at?: unknown }).updated_at === "string" ? (raw as { updated_at: string }).updated_at : null,
    },
  };
}

export async function loadCustomerProfile(
  email: string,
): Promise<ServerCustomerProfile | null> {
  return (await loadCustomerProfileResult(email)).profile;
}
