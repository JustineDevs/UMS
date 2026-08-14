import type { StorefrontShippingAddress } from "@universal-music-store/validation";
import type { ServerCustomerProfile } from "@/lib/server-customer-profile";

/** Medusa Store API cart address shape (snake_case). */
export type MedusaCartAddressPayload = {
  first_name: string;
  last_name: string;
  phone: string;
  address_1: string;
  address_2?: string;
  city: string;
  province: string;
  country_code: string;
  postal_code?: string;
};

export function normalizePhilippinePhoneE164(raw: string): string {
  const d = raw.replace(/[\s-]/g, "");
  if (d.startsWith("+639")) return d;
  if (d.startsWith("639")) return `+${d}`;
  if (d.startsWith("09")) return `+63${d.slice(1)}`;
  if (/^9\d{9}$/.test(d)) return `+63${d}`;
  return d.startsWith("+") ? d : `+${d}`;
}

function splitDisplayName(displayName: string): { first: string; last: string } {
  const t = displayName.trim();
  if (!t) return { first: "Customer", last: "-" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: parts[0]! };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export function storefrontShippingToMedusaAddress(
  addr: StorefrontShippingAddress,
): MedusaCartAddressPayload {
  const { first, last } = splitDisplayName(addr.fullName);
  const out: MedusaCartAddressPayload = {
    first_name: first.slice(0, 100),
    last_name: last.slice(0, 100),
    phone: normalizePhilippinePhoneE164(addr.phone),
    address_1: addr.line1.trim().slice(0, 200),
    city: addr.city.trim().slice(0, 100),
    province: addr.province.trim().toLowerCase().slice(0, 100),
    country_code: (addr.country ?? "PH").trim().toLowerCase(),
  };
  const brgy = addr.barangay?.trim();
  const l2 = addr.line2?.trim();
  const parts = [brgy ? `Barangay ${brgy}` : null, l2].filter(
    (x): x is string => Boolean(x && x.length > 0),
  );
  if (parts.length > 0) {
    out.address_2 = parts.join(". ").slice(0, 200);
  }
  const pc = addr.postalCode?.trim();
  if (pc) out.postal_code = pc.slice(0, 20);
  return out;
}

export function profileToCodCartAddresses(
  profile: ServerCustomerProfile,
  sessionEmail: string,
): {
  email: string;
  shipping_address: MedusaCartAddressPayload;
  billing_address: MedusaCartAddressPayload;
} | null {
  const email = sessionEmail.trim().toLowerCase();
  if (!email) return null;
  const addr = profile.shippingAddresses?.[0];
  if (!addr) return null;
  const shipping = storefrontShippingToMedusaAddress(addr);
  const billing = { ...shipping };
  return {
    email,
    shipping_address: shipping,
    billing_address: billing,
  };
}
