import type { Metadata } from "next";
import Link from "next/link";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";
import { fetchCustomerOrders } from "@/lib/account-orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Purchase history", robots: { index: false, follow: false } };

const filters = [
  ["", "All"],
  ["pending_payment", "To Pay"],
  ["pending", "To Ship"],
  ["shipped", "To Receive"],
  ["delivered", "Completed"],
  ["cancelled", "Cancelled"],
  ["returned", "Returns"],
] as const;

function formatMoney(amount: number, currency: string) {
  return `${currency.toUpperCase()} ${amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const query = await searchParams;
  const session = await getStorefrontSession();
  const selected = filters.some(([value]) => value === query.status) ? query.status ?? "" : "";
  const { orders, error } = session?.user.email ? await fetchCustomerOrders(session.user.email) : { orders: [], error: null };
  const visible = selected ? orders.filter((order) => order.status === selected) : orders;

  return (
    <AccountRouteFrame title="Purchase History" description="View and manage your past orders.">
      {!session ? <AccountSignInState message="Sign in to view your purchase history." /> : (
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
          <nav aria-label="Order status" className="flex gap-2 overflow-x-auto border-b border-outline-variant/15 pb-4">
            {filters.map(([value, label]) => <Link key={value || "all"} href={value ? `/account/orders?status=${value}` : "/account/orders"} aria-current={selected === value ? "page" : undefined} className={`min-h-11 shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold ${selected === value ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}>{label}</Link>)}
          </nav>
          {error ? <p className="mt-5 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error" role="alert">Purchase history is temporarily unavailable. Refresh and try again.</p> : null}
          {visible.length === 0 ? <div className="py-12 text-center"><p className="font-headline text-xl font-bold text-primary">No orders found</p><p className="mt-2 text-sm text-on-surface-variant">Your completed purchases will appear here.</p><Link href="/shop" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary">Start shopping</Link></div> : (
            <ul className="mt-5 divide-y divide-outline-variant/15">
              {visible.map((order) => <li key={order.id} className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-primary">Order {order.displayId}</p><p className="mt-1 text-xs text-on-surface-variant">{new Date(order.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" })} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}</p><span className="mt-3 inline-flex rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-primary">{formatStatus(order.status)}</span></div><div className="flex items-center justify-between gap-4 sm:justify-end"><p className="text-sm font-bold tabular-nums text-primary">{formatMoney(order.total, order.currency)}</p><Link href={`/account/orders/${encodeURIComponent(order.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-outline-variant/30 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-surface-container-low">View</Link></div></li>)}
            </ul>
          )}
        </section>
      )}
    </AccountRouteFrame>
  );
}
