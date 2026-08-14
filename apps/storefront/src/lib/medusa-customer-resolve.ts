import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";

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
