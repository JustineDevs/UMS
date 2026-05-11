import { isPhilippinesMobilePhone } from "@apparel-commerce/validation";
import type { ServerCustomerProfile } from "@/lib/server-customer-profile";

function requiresBarangay(country: string | undefined): boolean {
  return (country?.trim().toUpperCase() || "PH") === "PH";
}

export function isStorefrontProfileComplete(
  profile: ServerCustomerProfile | null,
): boolean {
  if (!profile?.displayName?.trim() || profile.displayName.trim().length < 2) {
    return false;
  }
  if (!profile.phone?.trim() || !isPhilippinesMobilePhone(profile.phone)) {
    return false;
  }
  const addr = profile.shippingAddresses?.[0];
  if (!addr) return false;
  if (
    !addr.fullName?.trim() ||
    !addr.line1?.trim() ||
    (requiresBarangay(addr.country) && !(addr.barangay?.trim() ?? "")) ||
    !addr.city?.trim() ||
    !addr.province?.trim()
  ) {
    return false;
  }
  if (!isPhilippinesMobilePhone(addr.phone)) return false;
  return true;
}

export function listMissingProfileParts(
  profile: ServerCustomerProfile | null,
): string[] {
  const m: string[] = [];
  if (!profile?.displayName?.trim() || profile.displayName.trim().length < 2) {
    m.push("Your name");
  }
  if (!profile?.phone?.trim() || !isPhilippinesMobilePhone(profile.phone)) {
    m.push("Mobile number");
  }
  const addr = profile?.shippingAddresses?.[0];
  if (!addr) {
    m.push("Delivery address");
  } else {
    if (
      !addr.fullName?.trim() ||
      !addr.line1?.trim() ||
      (requiresBarangay(addr.country) && !(addr.barangay?.trim() ?? "")) ||
      !addr.city?.trim() ||
      !addr.province?.trim()
    ) {
      m.push("Complete delivery address");
    }
    if (!isPhilippinesMobilePhone(addr.phone)) {
      m.push("Contact number on the delivery address");
    }
  }
  return m;
}
