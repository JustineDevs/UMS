import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { AccountProfilePanel } from "@/components/AccountProfilePanel";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { PreferencesControls } from "@/components/PreferencesControls";
import {
  computeAccountOrderStats,
  fetchCustomerOrders,
} from "@/lib/medusa-account-orders";
import { OrderCancelButton } from "@/components/OrderCancelButton";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildPageMetadata({
  title: "Account",
  description: "Manage your profile, saved addresses, and orders.",
  path: "/account",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const userEmail = user?.email?.trim() ?? "";
  const { orders } = userEmail
    ? await fetchCustomerOrders(userEmail)
    : { orders: [] };
  const profile = userEmail ? await loadCustomerProfile(userEmail) : null;
  const stats = computeAccountOrderStats(orders);
  const profileAvatar = profile?.avatarUrl ?? user?.image ?? null;

  return (
    <main className="storefront-page-shell max-w-4xl">
      <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
        Account
      </h1>
      <p className="font-body text-on-surface-variant mb-12">
        Manage your profile, saved addresses, and orders. Payment cards stay with
        your checkout provider.
      </p>

      {user && orders.length > 0 ? (
        <section className="mb-10 rounded-lg border border-outline-variant/20 bg-surface-container-low/50 p-6 md:col-span-2">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
            Your shopping KPIs
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Based on orders linked to this email in our store (same currency as
            listed).
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Orders placed
              </dt>
              <dd className="mt-1 font-headline text-2xl font-bold tabular-nums text-primary">
                {stats.orderCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Lifetime value (sum of totals)
              </dt>
              <dd className="mt-1 font-headline text-2xl font-bold tabular-nums text-primary">
                {orders[0]?.currency ?? "PHP"}{" "}
                {stats.lifetimeSpend.toLocaleString("en-PH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Average order value
              </dt>
              <dd className="mt-1 font-headline text-2xl font-bold tabular-nums text-primary">
                {orders[0]?.currency ?? "PHP"}{" "}
                {stats.averageOrderValue.toLocaleString("en-PH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8 md:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Preferences
            </h2>
            <Link
              href="/preferences"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open full preferences page
            </Link>
          </div>
          <div className="mt-6">
            <PreferencesControls />
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
            Profile
          </h2>
          {user ? (
            <div className="space-y-3">
              {profileAvatar ? (
                <Image
                  src={profileAvatar}
                  alt=""
                  width={56}
                  height={56}
                  className="rounded-full"
                  referrerPolicy="no-referrer"
                  unoptimized={shouldUnoptimizeImage(profileAvatar)}
                />
              ) : null}
              <p className="text-sm font-medium text-on-surface">{user.name}</p>
              <p className="text-sm text-on-surface-variant">{user.email}</p>
              <SignOutButton />
            </div>
          ) : (
            <>
              <p className="text-on-surface-variant text-sm mb-6">
                Sign in with Google to view and update your profile.
              </p>
              <Link
                href="/sign-in?callbackUrl=/account"
                className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded font-medium hover:opacity-90"
              >
                Sign in
              </Link>
            </>
          )}
        </section>

        {user ? (
          <AccountProfilePanel
            initial={{
              displayName: profile?.displayName ?? null,
              phone: profile?.phone ?? null,
              avatarUrl: profile?.avatarUrl ?? null,
              shippingAddresses: profile?.shippingAddresses ?? [],
            }}
          />
        ) : null}

        <section className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
            Order History
          </h2>
          {orders.length > 0 ? (
            <ul className="space-y-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between border-b border-surface-container-high pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-primary">
                      Order #{order.displayId}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} ·{" "}
                      {order.status.replace(/_/g, " ")} ·{" "}
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {order.currency} {order.total.toLocaleString("en-PH")}
                    </p>
                    <div className="flex flex-col items-end gap-1">
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View details
                      </Link>
                      <Link
                        href={`/track/${order.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Track
                      </Link>
                      <Link
                        href={`/account/orders/${order.id}/return`}
                        className="text-xs text-on-surface-variant hover:underline"
                      >
                        Return
                      </Link>
                      {(order.status === "pending" || order.status === "pending_payment" || order.status === "requires_action") && (
                        <OrderCancelButton
                          orderId={order.id}
                          orderDisplayId={order.displayId}
                        />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">
              No orders yet.{" "}
              <Link href="/shop" className="text-primary hover:underline">
                Start shopping
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      <section className="mt-12 bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
          Track an Order
        </h2>
        <p className="text-on-surface-variant text-sm mb-4">
          Enter your order number to track shipment status.
        </p>
        <form action="/track" method="GET" className="flex flex-col gap-4">
          <input
            type="text"
            name="orderId"
            placeholder="Order number or full tracking link from email"
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            name="t"
            placeholder="Tracking code (if not pasting full link)"
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="bg-primary text-on-primary px-6 py-3 rounded font-medium hover:opacity-90 w-fit"
          >
            Track
          </button>
        </form>
        <p className="text-xs text-on-surface-variant mt-2">
          Your confirmation email includes a secure tracking link. You need that
          link or both the order reference and tracking code together.
        </p>
      </section>
    </main>
  );
}
