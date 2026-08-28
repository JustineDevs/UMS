import { medusaAdminFetch } from "./medusa-admin-fetch";
import { medusaMinorToMajor } from "./medusa-money";
import { findMedusaCustomerIdByEmail } from "./medusa-customer-resolve";
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

/** Shopper-facing KPIs from the complete customer-scoped Medusa order scan. */
export function computeAccountOrderStats(orders: AccountOrder[]): {
  orderCount: number;
  lifetimeSpend: number | null;
  averageOrderValue: number | null;
  currency: string | null;
} {
  const orderCount = orders.length;
  const currencies = new Set(orders.map((order) => order.currency));
  if (currencies.size > 1) {
    return { orderCount, lifetimeSpend: null, averageOrderValue: null, currency: null };
  }
  const lifetimeSpend = orders.reduce((s, o) => s + (o.total || 0), 0);
  const averageOrderValue =
    orderCount > 0 ? Math.round((lifetimeSpend / orderCount) * 100) / 100 : 0;
  return {
    orderCount,
    lifetimeSpend,
    averageOrderValue,
    currency: orders[0]?.currency ?? null,
  };
}

type AdminOrderListRow = {
  id?: string;
  display_id?: string | number;
  email?: string | null;
  customer_id?: string | null;
  status?: string;
  total?: number;
  currency_code?: string;
  created_at?: string;
  items?: Array<{ quantity?: unknown }>;
};

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function accountOrderMatchesCustomer(
  orderCustomerId: string | null | undefined,
  customerId: string,
): boolean {
  const expected = customerId.trim();
  return expected.length > 0 && orderCustomerId?.trim() === expected;
}

export function accountOrderMatchesIdentity(
  orderCustomerId: string | null | undefined,
  orderEmail: string | null | undefined,
  customerId: string | null,
  email: string,
): boolean {
  if (customerId !== null) {
    return orderCustomerId?.trim() === customerId.trim();
  }
  return orderEmail?.trim().toLowerCase() === email.trim().toLowerCase();
}

export function accountOrderMatchesHistory(
  order: { id?: string; customer_id?: string | null; email?: string | null },
  customerId: string | null,
  email: string,
  legacyEmailMatchedOrderIds: ReadonlySet<string>,
): boolean {
  return (
    accountOrderMatchesIdentity(order.customer_id, order.email, customerId, email) ||
    (legacyEmailMatchedOrderIds.has(String(order.id ?? "")) &&
      !order.customer_id &&
      order.email?.trim().toLowerCase() === email.trim().toLowerCase())
  );
}

export type AccountOrderViewState =
  | "signed_out"
  | "loading"
  | "error"
  | "empty"
  | "ready";

export function getAccountOrderViewState(input: {
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  orderCount: number;
}): AccountOrderViewState {
  if (!input.authenticated) return "signed_out";
  if (input.loading) return "loading";
  if (input.error) return "error";
  return input.orderCount > 0 ? "ready" : "empty";
}

export function countAccountOrderItems(items: AdminOrderListRow["items"]): number {
  return Array.isArray(items)
    ? items.reduce((count, item) => {
        const quantity =
          typeof item.quantity === "number" && Number.isFinite(item.quantity)
            ? Math.max(0, Math.floor(item.quantity))
            : 0;
        return count + quantity;
      }, 0)
    : 0;
}

export function buildAccountOrdersQuery(
  email: string,
  customerId: string | null,
  offset: number,
): string {
  const params = new URLSearchParams({
    fields: "id,email,customer_id,display_id,status,total,currency_code,created_at,*items",
    limit: "100",
    offset: String(offset),
    order: "-created_at",
  });
  params.set(customerId ? "customer_id" : "email", customerId ?? email.trim().toLowerCase());
  return `/admin/orders?${params.toString()}`;
}

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
    const normalizedEmail = normalizeAccountEmail(email);
    const customerId = await findMedusaCustomerIdByEmail(normalizedEmail);
    const rows: AdminOrderListRow[] = [];
    const seenOrderIds = new Set<string>();
    const legacyEmailMatchedOrderIds = new Set<string>();
    const ownershipFilters = customerId ? [customerId, normalizedEmail] : [normalizedEmail];
    for (const ownershipFilter of ownershipFilters) {
      const filterCustomerId = ownershipFilter === customerId ? customerId : null;
      const seenPages = new Set<string>();
      for (let offset = 0; ; offset += 100) {
        const res = await medusaAdminFetch(
          buildAccountOrdersQuery(normalizedEmail, filterCustomerId, offset),
          { method: "GET" },
        );
        if (!res.ok) {
          return { orders: [], error: "Order history is temporarily unavailable." };
        }
        const data = (await res.json()) as { orders?: unknown[] };
        const page = Array.isArray(data.orders) ? (data.orders as AdminOrderListRow[]) : [];
        const pageKey = page.map((order) => String(order.id ?? "")).join(",");
        if (seenPages.has(pageKey)) {
          return { orders: [], error: "Order history is temporarily unavailable." };
        }
        seenPages.add(pageKey);
        for (const order of page) {
          const id = String(order.id ?? "");
          if (id && !seenOrderIds.has(id)) {
            seenOrderIds.add(id);
            rows.push(order);
            if (!filterCustomerId) legacyEmailMatchedOrderIds.add(id);
          }
        }
        if (page.length < 100) break;
      }
    }

    const mapped: AccountOrder[] = rows
      .filter((o) => {
        return accountOrderMatchesHistory(o, customerId, normalizedEmail, legacyEmailMatchedOrderIds);
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
        itemCount: countAccountOrderItems(o.items),
      }));

    return { orders: mapped, error: null };
  } catch {
    return { orders: [], error: "Order history is temporarily unavailable." };
  }
}
