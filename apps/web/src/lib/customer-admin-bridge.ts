import {
  fetchWorkerCustomerById,
  fetchWorkerCustomersForAdmin,
  fetchWorkerOrdersForAdmin,
} from "@/lib/worker-admin-bridge";

export type CrmCustomerRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_account: boolean;
  created_at: string;
};

export async function fetchCustomersForAdmin(limit = 100): Promise<CrmCustomerRow[]> {
  return fetchWorkerCustomersForAdmin(limit);
}

export type CrmCustomerOrderRow = {
  id: string;
  customer_id: string | null;
  display_id: string;
  status: string;
  email: string | null;
  total_minor: number;
  currency_code: string;
  created_at: string;
};

export async function fetchCustomerById(customerId: string): Promise<CrmCustomerRow | null> {
  return fetchWorkerCustomerById(customerId);
}

export async function fetchOrdersForCustomer(
  customerId: string,
  limit = 80,
): Promise<CrmCustomerOrderRow[]> {
  const result = await fetchWorkerOrdersForAdmin(Math.min(200, Math.max(1, limit)), 0, customerId);
  return result.orders.map((order) => ({
    id: order.id,
    customer_id: order.customer_id,
    display_id: order.order_number,
    status: order.status,
    email: order.email,
    total_minor: Math.round(order.grand_total * 100),
    currency_code: order.currency,
    created_at: order.created_at,
  }));
}

// Deprecated source aliases removed from runtime callers; retain no legacy API client.
