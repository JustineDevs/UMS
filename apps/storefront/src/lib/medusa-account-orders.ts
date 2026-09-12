import { medusaAdminFetch } from "./medusa-admin-fetch";
import { medusaMinorToMajor } from "./medusa-money";
import { findMedusaCustomerIdByEmail } from "./medusa-customer-resolve";
import { getMedusaSecretApiKey } from "./storefront-medusa-env";
import { createSupabaseServerClient } from "./supabase/server";

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

export type AccountOrderDetail = {
  id: string;
  customer_id?: string | null;
  display_id?: string | number;
  email?: string | null;
  status?: string;
  total?: number;
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  currency_code?: string;
  created_at?: string;
  updated_at?: string;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  metadata?: Record<string, unknown> | null;
  shipping_address?: Record<string, string | null> | null;
  items?: Array<{
    id: string;
    title?: string | null;
    quantity?: number;
    unit_price?: number;
    total?: number;
    variant?: { sku?: string | null } | null;
    thumbnail?: string | null;
  }>;
  fulfillments?: Array<{
    id?: string;
    status?: string;
    provider_id?: string;
    shipped_at?: string | null;
    tracking_numbers?: string[] | null;
    labels?: Array<{ tracking_number?: string | null } | null> | null;
  }>;
};

async function fetchWorkerCustomerOrders(): Promise<{ orders: AccountOrder[]; error: string | null } | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token?.trim();
    if (!accessToken) return { orders: [], error: "Sign in to view your order history." };
    const response = await fetch(`${base}/store/customers/me/orders?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return { orders: [], error: "Order history is temporarily unavailable." };
    const body = (await response.json()) as { orders?: unknown[] };
    const orders = (Array.isArray(body.orders) ? body.orders : []).flatMap((raw): AccountOrder[] => {
      if (!raw || typeof raw !== "object") return [];
      const row = raw as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      if (!id) return [];
      const currency = String(row.currency_code ?? "PHP").toUpperCase();
      const totalMinor = Number(row.total ?? 0);
      return [{
        id,
        displayId: row.display_id == null ? id : String(row.display_id),
        status: String(row.status ?? "unknown"),
        total: Number.isFinite(totalMinor) ? medusaMinorToMajor(totalMinor, currency) : 0,
        currency,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        itemCount: Math.max(0, Math.floor(Number(row.item_count ?? 0))),
      }];
    });
    return { orders, error: null };
  } catch {
    return { orders: [], error: "Order history is temporarily unavailable." };
  }
}

export async function fetchWorkerCustomerOrderDetail(
  orderId: string,
): Promise<{ order: AccountOrderDetail; error: null } | { order: null; error: string } | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token?.trim();
    if (!accessToken) return { order: null, error: "Sign in to view this order." };
    const response = await fetch(
      `${base}/store/customers/me/orders/${encodeURIComponent(orderId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (response.status === 404) return { order: null, error: "not_found" };
    if (!response.ok) return { order: null, error: "Order details are temporarily unavailable." };
    const body = (await response.json()) as { order?: Record<string, unknown> };
    const raw = body.order;
    if (!raw || typeof raw.id !== "string") return { order: null, error: "not_found" };
    const currency = String(raw.currency_code ?? "PHP").toUpperCase();
    const minor = (value: unknown): number | undefined => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? medusaMinorToMajor(parsed, currency) : undefined;
    };
    const address = raw.shipping_address;
    const items = Array.isArray(raw.items)
      ? raw.items.flatMap((value) => {
          if (!value || typeof value !== "object") return [];
          const item = value as Record<string, unknown>;
          const id = typeof item.id === "string" ? item.id : "";
          if (!id) return [];
          const quantity = Number(item.quantity);
          const unitPrice = minor(item.unit_price);
          return [{
            id,
            title: typeof item.title === "string" ? item.title : null,
            quantity: Number.isFinite(quantity) ? quantity : 0,
            unit_price: unitPrice,
            total: unitPrice == null || !Number.isFinite(quantity) ? undefined : unitPrice * quantity,
            variant: item.variant && typeof item.variant === "object"
              ? { sku: typeof (item.variant as Record<string, unknown>).sku === "string" ? (item.variant as Record<string, unknown>).sku as string : null }
              : null,
            thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : null,
          }];
        })
      : [];
    return {
      order: {
        id: raw.id,
        customer_id: typeof raw.customer_id === "string" ? raw.customer_id : null,
        display_id: raw.display_id == null ? undefined : String(raw.display_id),
        email: typeof raw.email === "string" ? raw.email : null,
        status: typeof raw.status === "string" ? raw.status : "unknown",
        total: minor(raw.total),
        subtotal: minor(raw.subtotal),
        tax_total: minor(raw.tax_total),
        shipping_total: minor(raw.shipping_total),
        discount_total: minor(raw.discount_total),
        currency_code: currency,
        created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
        updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
        payment_status: typeof raw.payment_status === "string" ? raw.payment_status : null,
        fulfillment_status: typeof raw.fulfillment_status === "string" ? raw.fulfillment_status : null,
        metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata as Record<string, unknown> : null,
        shipping_address: address && typeof address === "object" ? address as Record<string, string | null> : null,
        items,
        fulfillments: Array.isArray(raw.fulfillments) ? raw.fulfillments as AccountOrderDetail["fulfillments"] : [],
      },
      error: null,
    };
  } catch {
    return { order: null, error: "Order details are temporarily unavailable." };
  }
}

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
  const exactEmailMatch =
    order.email?.trim().toLowerCase() === email.trim().toLowerCase();
  return (
    accountOrderMatchesIdentity(order.customer_id, order.email, customerId, email) ||
    (!order.customer_id &&
      exactEmailMatch &&
      (customerId === null || legacyEmailMatchedOrderIds.has(String(order.id ?? ""))))
  );
}

/** Allows legacy guest orders only when no customer id is attached and email matches exactly. */
export function accountOrderMatchesDetail(
  order: { customer_id?: string | null; email?: string | null },
  customerId: string,
  email: string,
): boolean {
  return (
    accountOrderMatchesCustomer(order.customer_id, customerId) ||
    (!order.customer_id && order.email?.trim().toLowerCase() === email.trim().toLowerCase())
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

function buildAccountOrdersFallbackQuery(offset: number): string {
  const params = new URLSearchParams({
    fields: "id,email,customer_id,display_id,status,total,currency_code,created_at,*items",
    limit: "100",
    offset: String(offset),
    order: "-created_at",
  });
  return `/admin/orders?${params.toString()}`;
}

/**
 * Fetches orders for a customer by email using the Medusa Admin API.
 * The Store API requires Medusa customer auth (which this storefront does not use).
 * The Admin API with MEDUSA_SECRET_API_KEY allows server-side order lookup by email.
 */
export async function fetchCustomerOrders(
  email: string,
  sessionCustomerId?: string | null,
): Promise<{ orders: AccountOrder[]; error: string | null }> {
  const workerOrders = await fetchWorkerCustomerOrders();
  if (workerOrders) return workerOrders;
  const secret = getMedusaSecretApiKey();
  if (!secret) {
    return { orders: [], error: "Commerce admin key is not configured." };
  }
  try {
    const normalizedEmail = normalizeAccountEmail(email);
    const customerId =
      sessionCustomerId?.trim() || (await findMedusaCustomerIdByEmail(normalizedEmail));
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

    // Some Medusa deployments return 200 for unsupported list filters. Scan the
    // bounded admin projection only when filtered queries found nothing, then
    // apply the same exact ownership predicate before mapping or returning it.
    const hasOwnedRow = rows.some((order) =>
      accountOrderMatchesHistory(
        order,
        customerId,
        normalizedEmail,
        legacyEmailMatchedOrderIds,
      ),
    );
    if (!hasOwnedRow) {
      const seenPages = new Set<string>();
      for (let offset = 0; ; offset += 100) {
        const res = await medusaAdminFetch(buildAccountOrdersFallbackQuery(offset), {
          method: "GET",
        });
        if (!res.ok) break;
        const data = (await res.json()) as { orders?: unknown[] };
        const page = Array.isArray(data.orders) ? (data.orders as AdminOrderListRow[]) : [];
        const pageKey = page.map((order) => String(order.id ?? "")).join(",");
        if (seenPages.has(pageKey)) break;
        seenPages.add(pageKey);
        for (const order of page) {
          const id = String(order.id ?? "");
          if (id && !seenOrderIds.has(id)) {
            seenOrderIds.add(id);
            rows.push(order);
            if (!order.customer_id) legacyEmailMatchedOrderIds.add(id);
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
