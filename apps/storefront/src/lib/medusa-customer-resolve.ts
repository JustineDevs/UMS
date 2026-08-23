import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";

export function buildMedusaCustomerProfilePatch(input: {
  displayName?: string | null;
  phone?: string | null;
}): Record<string, string> {
  const name = input.displayName?.trim() ?? "";
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    ...(name ? { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") } : {}),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  };
}

export async function syncMedusaCustomerProfile(
  customerId: string | null,
  input: { displayName?: string | null; phone?: string | null },
): Promise<boolean> {
  if (!customerId?.trim()) return true;
  const patch = buildMedusaCustomerProfilePatch(input);
  if (Object.keys(patch).length === 0) return true;
  const response = await medusaAdminFetch(`/admin/customers/${encodeURIComponent(customerId.trim())}`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
  await response.body?.cancel().catch(() => undefined);
  return response.ok;
}

/**
 * Resolves Medusa `customer.id` for OAuth email (creates customer if missing).
 * Server-only; used by cart merge and authenticated review submission.
 */
export async function findOrCreateMedusaCustomerIdByEmail(
  email: string,
): Promise<string | null> {
  const q = email.trim().toLowerCase();
  if (!q) return null;
  let listRes = await medusaAdminFetch(
    `/admin/customers?q=${encodeURIComponent(q)}`,
  );
  if (!listRes.ok) {
    listRes = await medusaAdminFetch(
      `/admin/customers?email=${encodeURIComponent(q)}`,
    );
  }
  if (!listRes.ok) return null;
  const listJson = (await listRes.json()) as {
    customers?: Array<{ id: string }>;
  };
  let id = listJson.customers?.[0]?.id;
  if (!id) {
    const createRes = await medusaAdminFetch("/admin/customers", {
      method: "POST",
      body: JSON.stringify({ email: q }),
    });
    if (!createRes.ok) return null;
    const created = (await createRes.json()) as { customer?: { id: string } };
    id = created.customer?.id;
  }
  return id ?? null;
}

export async function findMedusaCustomerIdByEmail(
  email: string,
): Promise<string | null> {
  const q = email.trim().toLowerCase();
  if (!q) return null;
  try {
    const response = await medusaAdminFetch(
      `/admin/customers?email=${encodeURIComponent(q)}&limit=10&fields=id,email`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      customers?: Array<{ id?: string; email?: string | null }>;
    };
    const exact = body.customers?.find(
      (customer) => customer.email?.trim().toLowerCase() === q,
    );
    return exact?.id?.trim() || null;
  } catch {
    return null;
  }
}
