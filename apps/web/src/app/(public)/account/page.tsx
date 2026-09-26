import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  buildTrackingUrl,
  DEFAULT_PUBLIC_SITE_ORIGIN,
} from "@universal-music-store/sdk";
import { AccountProfilePanel } from "@/components/AccountProfilePanel";
import { getStorefrontSession } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { PreferencesControls } from "@/components/PreferencesControls";
import {
  computeAccountOrderStats,
  fetchCustomerOrders,
  getAccountOrderViewState,
  accountOrderMatchesStatusFilter,
} from "@/lib/account-orders";
import { OrderCancelButton } from "@/components/OrderCancelButton";
import { loadCustomerProfileResult } from "@/lib/server-customer-profile";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { AccountSectionNav } from "@/components/AccountSectionNav";
import { AccountPrivacyControls } from "@/components/AccountPrivacyControls";
import { AccountMarketingPreferencesPanel } from "@/components/AccountMarketingPreferencesPanel";
import { AccountOrderPreferencesPanel } from "@/components/AccountOrderPreferencesPanel";
import { MapPin, PackageCheck, Pencil, ShieldCheck, UserRound } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = buildPageMetadata({
  title: "Account",
  description: "Manage your profile, saved addresses, and orders.",
  path: "/account",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
  referrer: "no-referrer",
});

const accountNav = [
  ["overview", "Profile", "person"],
  ["orders", "Orders", "receipt_long"],
  ["profile", "Profile & addresses", "person"],
  ["notifications", "Notifications", "notifications"],
  ["preferences", "Preferences", "tune"],
  ["loyalty", "Loyalty wallet", "stars"],
] as const;

const orderFilters = [
  ["", "All orders"],
  ["pending_payment", "To pay"],
  ["pending", "To process"],
  ["shipped", "To receive"],
  ["delivered", "Completed"],
  ["cancelled", "Cancelled"],
  ["returned", "Returns"],
] as const;

type AccountPageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const query = await searchParams;
  const selectedStatus = orderFilters.some(([value]) => value === query.status)
    ? (query.status ?? "")
    : "";
  const orderSearch = (query.q ?? "").trim().toLowerCase();
  const session = await getStorefrontSession();
  const user = session?.user;
  const userEmail = user?.email?.trim() ?? "";
  const { orders, error: ordersError } = userEmail
    ? await fetchCustomerOrders(userEmail)
    : { orders: [], error: null };
  const profileResult = userEmail
    ? await loadCustomerProfileResult(userEmail)
    : { profile: null, unavailable: false };
  const profile = profileResult.profile;
  const stats = computeAccountOrderStats(orders);
  const orderViewState = getAccountOrderViewState({
    authenticated: Boolean(user),
    loading: false,
    error: ordersError,
    orderCount: orders.length,
  });
  const profileAvatar = profile?.avatarUrl ?? user?.image ?? null;
  const visibleOrders = orders.filter((order) => {
    const matchesStatus = accountOrderMatchesStatusFilter(
      order.status,
      selectedStatus,
    );
    const matchesSearch =
      !orderSearch ||
      [order.id, order.displayId, order.status].some((value) =>
        value.toLowerCase().includes(orderSearch),
      );
    return matchesStatus && matchesSearch;
  });

  return (
    <main className="storefront-page-shell storefront-content-wide max-w-[1320px]">
      <div className="grid min-w-0 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start lg:sticky lg:top-28">
          <div className="mb-5 hidden items-center gap-3 lg:flex">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary text-on-primary"><UserRound className="size-5" aria-hidden="true" /></span>
            <div>
              <p className="font-headline text-xs font-bold uppercase tracking-[0.18em] text-primary">
                My account
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Personal dashboard
              </p>
            </div>
          </div>
          <AccountSectionNav sections={accountNav} />
          <div className="mt-8 hidden rounded-2xl bg-surface-container-low p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Need help?
            </p>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Your order confirmation contains a secure tracking link.
            </p>
            <Link
              href="/contact"
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Contact support <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          <header className="border-b border-outline-variant/15 pb-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              // ACCOUNT SETTINGS
            </p>
            <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
              Manage your account settings and set e-mail preferences.
            </p>
            <nav aria-label="Settings categories" className="mt-6 flex gap-2 overflow-x-auto pb-1">
              {[
                ["profile", "Profile"],
                ["overview", "Account"],
                ["orders", "Billing"],
                ["preferences", "Appearance"],
                ["notifications", "Notifications"],
                ["preferences", "Display"],
              ].map(([id, label], index) => (
                <a
                  key={`${id}-${label}`}
                  href={`#${id}`}
                  className={`min-h-11 shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition ${index === 0 ? "bg-surface-container-low text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}
                >
                  {label}
                </a>
              ))}
            </nav>
          </header>

          <section id="overview" className="scroll-mt-28 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-headline text-2xl font-bold tracking-tight text-primary">Profile</h1>
                <p className="mt-1 text-sm text-on-surface-variant">Manage your account profile and delivery details.</p>
              </div>
              <span className="hidden text-sm text-on-surface-variant sm:inline">Home <span aria-hidden="true">›</span> Profile</span>
            </div>
            <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  {profileAvatar ? <Image src={profileAvatar} alt="" width={64} height={64} className="size-16 rounded-full object-cover" referrerPolicy="no-referrer" unoptimized={shouldUnoptimizeImage(profileAvatar)} /> : <span className="grid size-16 place-items-center rounded-full bg-surface-container-low text-primary"><UserRound className="size-7" aria-hidden="true" /></span>}
                  <div><h2 className="font-headline text-xl font-bold text-primary">{user?.name || profile?.displayName || "Your profile"}</h2><p className="mt-1 text-sm text-on-surface-variant">{user?.email || "Sign in to manage your profile"}</p></div>
                </div>
                <a href="#profile" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low"><Pencil className="size-4" aria-hidden="true" /> Edit</a>
              </div>
              <dl className="mt-7 grid gap-5 border-t border-outline-variant/15 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-on-surface-variant">Name</dt><dd className="mt-1 text-sm font-semibold text-primary">{profile?.displayName || user?.name || "Not provided"}</dd></div>
                <div><dt className="text-xs text-on-surface-variant">Email address</dt><dd className="mt-1 break-all text-sm font-semibold text-primary">{user?.email || "Not provided"}</dd></div>
                <div><dt className="text-xs text-on-surface-variant">Phone</dt><dd className="mt-1 text-sm font-semibold text-primary">{profile?.phone || "Not provided"}</dd></div>
                <div><dt className="text-xs text-on-surface-variant">Orders</dt><dd className="mt-1 text-sm font-semibold text-primary">{stats.orderCount}</dd></div>
              </dl>
            </section>
            <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><MapPin className="size-5 text-primary" aria-hidden="true" /><h2 className="font-headline text-lg font-bold text-primary">Address</h2></div><a href="#profile" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low"><Pencil className="size-4" aria-hidden="true" /> Edit</a></div>
              {profile?.shippingAddresses?.[0] ? <div className="mt-5 grid gap-5 border-t border-outline-variant/15 pt-5 sm:grid-cols-2"><div><p className="text-xs text-on-surface-variant">Default address</p><p className="mt-1 text-sm font-semibold text-primary">{profile.shippingAddresses[0].fullName}</p><p className="mt-1 text-sm leading-6 text-on-surface-variant">{profile.shippingAddresses[0].line1}, {profile.shippingAddresses[0].barangay}, {profile.shippingAddresses[0].city}, {profile.shippingAddresses[0].province}</p></div><div><p className="text-xs text-on-surface-variant">Phone</p><p className="mt-1 text-sm font-semibold text-primary">{profile.shippingAddresses[0].phone}</p></div></div> : <p className="mt-5 border-t border-outline-variant/15 pt-5 text-sm text-on-surface-variant">No saved shipping address yet. Add one to speed up checkout.</p>}
            </section>
            <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /><h2 className="font-headline text-lg font-bold text-primary">Security</h2></div><a href="#profile" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low"><Pencil className="size-4" aria-hidden="true" /> Manage</a></div><p className="mt-4 text-sm text-on-surface-variant">Your account uses secure Google sign-in. Payment cards remain with the checkout provider.</p></section>
          </section>

          <section
            id="orders"
            className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7"
          >
            <div className="flex items-end justify-between gap-4 border-b border-outline-variant/15 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Recent activity
                </p>
                <h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">
                  Order history
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">View and manage your past orders.</p>
              </div>
              <Link
                href="/shop"
                className="hidden min-h-11 items-center text-sm font-semibold text-primary hover:underline sm:inline-flex"
              >
                Continue shopping ↗
              </Link>
            </div>
            <nav
              aria-label="Filter orders"
              className="-mx-1 mt-5 flex gap-1 overflow-x-auto pb-1"
            >
              {orderFilters.map(([value, label]) => {
                const params = new URLSearchParams();
                if (value) params.set("status", value);
                if (query.q?.trim()) params.set("q", query.q.trim());
                const href = params.toString()
                  ? `/account?${params.toString()}#orders`
                  : "/account#orders";
                return (
                  <Link
                    key={value || "all"}
                    href={href}
                    aria-current={selectedStatus === value ? "page" : undefined}
                    className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${selectedStatus === value ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <form
              action="/account"
              method="GET"
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              {selectedStatus ? (
                <input type="hidden" name="status" value={selectedStatus} />
              ) : null}
              <label htmlFor="account-order-search" className="sr-only">
                Search orders
              </label>
              <input
                id="account-order-search"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Search by order number or status"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                className="min-h-11 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-surface-container-low"
              >
                Search orders
              </button>
            </form>
            {ordersError ? (
              <div className="space-y-3 py-8 text-sm text-error" role="alert">
                <p>{ordersError}</p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/account?retry=1"
                    className="font-semibold underline"
                  >
                    Retry order history
                  </Link>
                  <Link
                    href="/contact?topic=orders"
                    className="font-semibold underline"
                  >
                    Contact support
                  </Link>
                </div>
              </div>
            ) : orderViewState === "signed_out" ? (
              <div className="space-y-3 py-8 text-sm text-on-surface-variant">
                <p>Sign in to view your order history.</p>
                <Link
                  href="/sign-in?callbackUrl=/account"
                  className="font-semibold text-primary underline"
                >
                  Sign in to your account
                </Link>
              </div>
            ) : orderViewState === "ready" ? (
              visibleOrders.length > 0 ? (
                <ul className="space-y-3 pt-5">
                  {visibleOrders.map((order) => (
                    <li
                      key={order.id}
                      className="flex flex-col gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-container-low text-primary"><PackageCheck className="size-5" aria-hidden="true" /></span>
                        <div>
                          <p className="text-sm font-semibold text-primary">
                            Order #{order.displayId}
                          </p>
                          <p className="mt-1 text-xs capitalize text-on-surface-variant">
                            {order.itemCount} item
                            {order.itemCount !== 1 ? "s" : ""} ·{" "}
                            {order.status.replace(/_/g, " ")} ·{" "}
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString(
                                  "en-PH",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : ""}
                          </p>
                          <span className="mt-2 inline-flex rounded-full bg-surface-container-low px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">{order.status.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                        <p className="w-full text-sm font-semibold text-primary sm:w-auto">
                          {order.currency} {order.total.toLocaleString("en-PH")}
                        </p>
                        <Link
                          href={"/account/orders/" + order.id}
                          className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline"
                        >
                          Details
                        </Link>
                        {(() => {
                          const trackingUrl = buildTrackingUrl(
                            process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
                              DEFAULT_PUBLIC_SITE_ORIGIN,
                            order.id,
                            {
                              customerEmail: user?.email ?? undefined,
                              storeId:
                                process.env.DEFAULT_ORGANIZATION_ID?.trim(),
                            },
                          );
                          return trackingUrl ? (
                            <Link
                              href={trackingUrl}
                              className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline"
                            >
                              Track
                            </Link>
                          ) : null;
                        })()}
                        <Link
                          href={"/account/orders/" + order.id + "/return"}
                          className="inline-flex min-h-11 items-center text-xs text-on-surface-variant hover:underline"
                        >
                          Return
                        </Link>
                        {order.status === "pending" ||
                        order.status === "pending_payment" ||
                        order.status === "requires_action" ? (
                          <OrderCancelButton
                            orderId={order.id}
                            orderDisplayId={order.displayId}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-8 text-sm text-on-surface-variant">
                  No orders match these filters.{" "}
                  <Link
                    href="/account#orders"
                    className="font-semibold text-primary hover:underline"
                  >
                    Clear filters
                  </Link>
                  .
                </div>
              )
            ) : (
              <div className="py-8 text-sm text-on-surface-variant">
                No orders yet.{" "}
                <Link
                  href="/shop"
                  className="font-semibold text-primary hover:underline"
                >
                  Start shopping
                </Link>
                .
              </div>
            )}
          </section>

          {user ? (
            <section
              id="profile"
              className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7"
            >
              <div className="mb-6 flex flex-col gap-4 border-b border-outline-variant/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {profileAvatar ? (
                    <Image
                      src={profileAvatar}
                      alt=""
                      width={64}
                      height={64}
                      className="size-16 rounded-2xl object-cover"
                      referrerPolicy="no-referrer"
                      unoptimized={shouldUnoptimizeImage(profileAvatar)}
                    />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-2xl bg-surface-container-low text-primary">
                      <UserRound className="size-7" aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Personal details
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="max-w-xs text-xs leading-5 text-on-surface-variant">
                    Keep your details current for smoother delivery and
                    checkout.
                  </p>
                  <SignOutButton />
                </div>
              </div>
              {profileResult.unavailable ? (
                <p
                  className="mb-5 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error"
                  role="alert"
                >
                  Your profile is temporarily unavailable. No changes were
                  saved. Refresh and try again.
                </p>
              ) : null}
              <AccountProfilePanel
                initial={{
                  displayName: profile?.displayName ?? null,
                  phone: profile?.phone ?? null,
                  avatarUrl: profile?.avatarUrl ?? null,
                  shippingAddresses: profile?.shippingAddresses ?? [],
                  updatedAt: profile?.updatedAt ?? null,
                }}
              />
              <AccountPrivacyControls />
              <section
                id="notifications"
                className="mt-6 scroll-mt-28 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5"
                aria-labelledby="account-notifications-heading"
              >
                <AccountMarketingPreferencesPanel headingId="account-notifications-heading" />
              </section>
            </section>
          ) : (
            <section className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-6">
              <p className="text-sm text-on-surface-variant">
                Sign in with Google to update your profile and save addresses.
              </p>
            </section>
          )}

          <section
            id="preferences"
            className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7"
          >
            <div className="flex flex-col gap-2 border-b border-outline-variant/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Personalize
                </p>
                <h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">
                  Preferences
                </h2>
              </div>
              <Link
                href="/preferences"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                Open full settings ↗
              </Link>
            </div>
            <div className="mt-6">
              <PreferencesControls />
            </div>
            {user ? <AccountOrderPreferencesPanel /> : null}
          </section>

          <section
            id="loyalty"
            className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7"
          >
            <div className="flex flex-col gap-2 border-b border-outline-variant/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Rewards
                </p>
                <h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">
                  Loyalty wallet
                </h2>
              </div>
              <Link
                href="/account/loyalty"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                View wallet ↗
              </Link>
            </div>
            <p className="mt-5 text-sm text-on-surface-variant">
              Review your available points and recent loyalty activity.
            </p>
          </section>

          <section className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Order support
              </p>
              <h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">
                Track an order
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Paste the secure tracking link from your confirmation email.
              </p>
            </div>
            <form
              action="/api/tracking-link/resolve"
              method="POST"
              className="grid gap-3 sm:grid-cols-[1fr_auto]"
            >
              <input
                type="url"
                name="trackingUrl"
                placeholder="https://…/track/cap_…"
                aria-label="Secure tracking link"
                required
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:opacity-90"
              >
                Track order
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
