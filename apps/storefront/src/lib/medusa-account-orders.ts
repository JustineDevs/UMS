import { medusaAdminFetch } from "./medusa-admin-fetch";
import { medusaMinorToMajor } from "./medusa-money";
import { getMedusaSecretApiKey } from "./storefront-medusa-env";

export type AccountOrder = {
  id: string;
  displayId: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  itemCount: number;
};

/** Simple shopper-facing KPIs from Medusa order list (same currency assumed). */
export function computeAccountOrderStats(orders: AccountOrder[]): {
  orderCount: number;
  lifetimeSpend: number;
  averageOrderValue: number;
} {
  const orderCount = orders.length;
  const lifetimeSpend = orders.reduce((s, o) => s + (o.total || 0), 0);
  const averageOrderValue =
    orderCount > 0 ? Math.round((lifetimeSpend / orderCount) * 100) / 100 : 0;
  return { orderCount, lifetimeSpend, averageOrderValue };
}

type AdminOrderListRow = {
  id?: string;
  display_id?: string | number;
  email?: string | null;
  status?: string;
  total?: number;
  currency_code?: string;
  created_at?: string;
  items?: unknown[];
};

/**
 * Fetches orders for a customer by email using the Medusa Admin API.
 * The Store API requires Medusa customer auth (which this storefront does not use).
 * The Admin API with MEDUSA_SECRET_API_KEY allows server-side order lookup by email.
 */
export async function fetchCustomerOrders(
  email: string,
): Promise<{ orders: AccountOrder[]; error: string | null }> {
  const secret = getMedusaSecretApiKey();
  if (!secret) {
    return { orders: [], error: "Commerce admin key is not configured." };
  }
  try {
    const params = new URLSearchParams({
      fields: "id,email,display_id,status,total,currency_code,created_at,*items",
      limit: "20",
      offset: "0",
      order: "-created_at",
    });

    const res = await medusaAdminFetch(
      `/admin/orders?${params.toString()}`,
      { method: "GET" },
    );

    if (!res.ok) {
      return { orders: [], error: null };
    }

    const data = (await res.json()) as { orders?: unknown[] };
    if (!data.orders || !Array.isArray(data.orders)) {
      return { orders: [], error: null };
    }

    const rows = data.orders as AdminOrderListRow[];
    const normalizedEmail = email.toLowerCase();

    const mapped: AccountOrder[] = rows
      .filter((o) => {
        const orderEmail = o.email;
        return (
          typeof orderEmail === "string" &&
          orderEmail.toLowerCase() === normalizedEmail
        );
      })
      .map((o) => ({
        id: String(o.id ?? ""),
        displayId:
          o.display_id != null ? String(o.display_id) : String(o.id ?? ""),
        status: String(o.status ?? "unknown"),
        total:
          typeof o.total === "number"
            ? medusaMinorToMajor(
                o.total,
                String(o.currency_code ?? "PHP"),
              )
            : 0,
        currency: String(o.currency_code ?? "PHP").toUpperCase(),
        createdAt: String(o.created_at ?? ""),
        itemCount: Array.isArray(o.items) ? o.items.length : 0,
      }));

    return { orders: mapped, error: null };
  } catch {
    return { orders: [], error: null };
  }
}
