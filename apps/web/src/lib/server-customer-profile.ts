import type { StorefrontShippingAddress } from "@universal-music-store/validation";
import { createHmac } from "node:crypto";
import { getStorefrontSession } from "@/lib/auth";
import { readResponseJson } from "@/lib/read-response-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Normalize profile JSON from both the Worker (snake_case) and the web app (camelCase). */
export function normalizeStorefrontShippingAddress(
  value: unknown,
): StorefrontShippingAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const fullName = stringValue(row.fullName ?? row.full_name);
  const line1 = stringValue(row.line1 ?? row.address_1);
  const city = stringValue(row.city);
  const province = stringValue(row.province);
  if (!fullName || !line1 || !city || !province) return null;
  return {
    ...(stringValue(row.id) ? { id: stringValue(row.id) } : {}),
    ...(typeof row.isDefault === "boolean"
      ? { isDefault: row.isDefault }
      : typeof row.is_default === "boolean"
        ? { isDefault: row.is_default }
        : {}),
    fullName,
    phone: stringValue(row.phone) ?? "",
    line1,
    ...(stringValue(row.line2 ?? row.address_2)
      ? { line2: stringValue(row.line2 ?? row.address_2) }
      : {}),
    ...(stringValue(row.barangay) ? { barangay: stringValue(row.barangay) } : {}),
    city,
    province,
    ...(stringValue(row.postalCode ?? row.postal_code)
      ? { postalCode: stringValue(row.postalCode ?? row.postal_code) }
      : {}),
    country: stringValue(row.country ?? row.country_code) ?? "PH",
  };
}

const localE2eProfile: ServerCustomerProfile = {
  displayName: "E2E Tester",
  phone: "+639171234567",
  avatarUrl: null,
  shippingAddresses: [
    {
      fullName: "E2E Tester",
      line1: "123 Test Street",
      city: "Manila",
      postalCode: "1000",
      barangay: "Barangay Test",
      province: "Metro Manila",
      country: "PH",
      phone: "+639171234567",
    },
  ],
  updatedAt: "2099-01-01T00:00:00.000Z",
};

function isLocalE2eProfileEnabled(): boolean {
  return process.env.UVS_E2E_LOCAL === "1" && process.env.VERCEL !== "1";
}

function workerBaseUrl() {
  return process.env.API_URL?.trim().replace(/\/$/, "") || null;
}

function internalStorefrontToken(userId: string, email: string): string | null {
  if (!isLocalE2eProfileEnabled() || process.env.UVS_E2E_REAL_SESSION !== "1")
    return null;
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      scope: "storefront:profile",
      iss: "uvs.internal",
      aud: "uvs-worker",
      iat: now,
      exp: now + 60,
    }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(input)
    .digest("base64url");
  return signature ? `${input}.${signature}` : null;
}

async function localE2eWorkerToken(email: string): Promise<string | null> {
  if (!isLocalE2eProfileEnabled() || process.env.UVS_E2E_REAL_SESSION !== "1")
    return null;
  const session = await getStorefrontSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase();
  if (!sessionEmail || sessionEmail !== email.trim().toLowerCase()) return null;
  return internalStorefrontToken(
    session?.user?.id?.trim() || sessionEmail,
    sessionEmail,
  );
}

function mapProfile(value: unknown): ServerCustomerProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const rawAddresses = row.shipping_addresses;
  const shippingAddresses = Array.isArray(rawAddresses)
    ? rawAddresses.flatMap((item) => {
        const normalized = normalizeStorefrontShippingAddress(item);
        return normalized ? [normalized] : [];
      })
    : [];
  return {
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    shippingAddresses,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function loadCustomerProfileResult(
  email: string,
): Promise<CustomerProfileLoadResult> {
  if (!email.trim()) return { profile: null, unavailable: false };
  if (
    isLocalE2eProfileEnabled() &&
    ["e2e-test@example.com", "local-admin@example.com"].includes(
      email.trim().toLowerCase(),
    )
  ) {
    return { profile: localE2eProfile, unavailable: false };
  }
  const baseUrl = workerBaseUrl();
  if (!baseUrl) return { profile: null, unavailable: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const token =
      (await localE2eWorkerToken(email)) || data.session?.access_token?.trim();
    if (!token) return { profile: null, unavailable: false };
    const response = await fetch(`${baseUrl}/store/customers/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return { profile: null, unavailable: response.status >= 500 };
    const payload = await readResponseJson<{ profile?: unknown } | null>(
      response,
      null,
    );
    return { profile: mapProfile(payload?.profile), unavailable: false };
  } catch {
    return { profile: null, unavailable: true };
  }
}

export async function loadCustomerProfile(
  email: string,
): Promise<ServerCustomerProfile | null> {
  return (await loadCustomerProfileResult(email)).profile;
}
