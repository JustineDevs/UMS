/**
 * Server-side Medusa Admin reads for GDPR export (commerce of record).
 */
import {
  getMedusaAdminBaseUrl,
  getMedusaSecretApiKey,
} from "@universal-music-store/sdk";

function medusaAdminAuthHeader(secret: string): string {
  const payload = `${secret}:`;
  const b64 = Buffer.from(payload, "utf8").toString("base64");
  return `Basic ${b64}`;
}

export async function fetchMedusaOrdersForComplianceEmail(
  email: string,
): Promise<{ orders: unknown[]; error: string | null }> {
  const root = getMedusaAdminBaseUrl();
  const secret = getMedusaSecretApiKey();
  if (!secret) {
    return { orders: [], error: "medusa_not_configured" };
  }
  const q = encodeURIComponent(email);
  const res = await fetch(`${root}/admin/orders?q=${q}&limit=200`, {
    headers: {
      Authorization: medusaAdminAuthHeader(secret),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { orders: [], error: `medusa_orders_${res.status}:${t.slice(0, 200)}` };
  }
  const json = (await res.json()) as { orders?: unknown[] };
  return { orders: Array.isArray(json.orders) ? json.orders : [], error: null };
}

export async function deleteMedusaCustomerByEmail(
  email: string,
): Promise<{ deleted: boolean; error: string | null }> {
  const root = getMedusaAdminBaseUrl();
  const secret = getMedusaSecretApiKey();
  if (!secret) {
    return { deleted: false, error: "medusa_not_configured" };
  }
  const listRes = await fetch(
    `${root}/admin/customers?q=${encodeURIComponent(email)}&limit=5`,
    {
      headers: { Authorization: medusaAdminAuthHeader(secret) },
    },
  );
  if (!listRes.ok) {
    return { deleted: false, error: `list_${listRes.status}` };
  }
  const listJson = (await listRes.json()) as {
    customers?: Array<{ id: string }>;
  };
  const id = listJson.customers?.[0]?.id;
  if (!id) {
    return { deleted: false, error: null };
  }
  const del = await fetch(`${root}/admin/customers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: medusaAdminAuthHeader(secret) },
  });
  if (!del.ok) {
    const t = await del.text().catch(() => "");
    return { deleted: false, error: `delete_${del.status}:${t.slice(0, 200)}` };
  }
  return { deleted: true, error: null };
}
