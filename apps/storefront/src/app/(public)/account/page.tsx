import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { buildTrackingUrl, DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { AccountProfilePanel } from "@/components/AccountProfilePanel";
import { getStorefrontSession } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { PreferencesControls } from "@/components/PreferencesControls";
import { computeAccountOrderStats, fetchCustomerOrders } from "@/lib/medusa-account-orders";
import { OrderCancelButton } from "@/components/OrderCancelButton";
import { loadCustomerProfileResult } from "@/lib/server-customer-profile";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { AccountSectionNav } from "@/components/AccountSectionNav";
import { AccountPrivacyControls } from "@/components/AccountPrivacyControls";

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
  ["overview", "Overview", "dashboard"],
  ["orders", "Orders", "receipt_long"],
  ["profile", "Profile & addresses", "person"],
  ["preferences", "Preferences", "tune"],
] as const;

export default async function AccountPage() {
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
  const profileAvatar = profile?.avatarUrl ?? user?.image ?? null;
  const currency = stats.currency ?? (stats.lifetimeSpend === null ? "Multiple currencies" : "PHP");

  return (
    <main className="storefront-page-shell storefront-content-wide max-w-[1320px]">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="self-start lg:sticky lg:top-28">
          <div className="mb-5 hidden items-center gap-3 lg:flex">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-on-primary">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </span>
            <div>
              <p className="font-headline text-xs font-bold uppercase tracking-[0.18em] text-primary">My account</p>
              <p className="mt-1 text-xs text-on-surface-variant">Personal dashboard</p>
            </div>
          </div>
          <AccountSectionNav sections={accountNav} />
          <div className="mt-8 hidden rounded-2xl bg-surface-container-low p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Need help?</p>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">Your order confirmation contains a secure tracking link.</p>
            <Link href="/contact" className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline">Contact support <span aria-hidden="true">↗</span></Link>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          <section id="overview" className="scroll-mt-28 overflow-hidden rounded-[2rem] bg-primary p-6 text-on-primary shadow-[0_24px_60px_rgba(49,46,43,0.14)] sm:p-9">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-on-primary/65">Account overview</p>
                <h1 className="max-w-xl font-headline text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">
                  {user ? "Welcome back" + (user.name ? ", " + user.name.split(" ")[0] : "") + "." : "Your account, in one place."}
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-on-primary/75">Manage your profile, saved addresses, orders, and shopping preferences. Payment cards stay with your checkout provider.</p>
              </div>
              {!user ? <Link href="/sign-in?callbackUrl=/account" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-on-primary px-4 py-2.5 text-sm font-semibold text-primary hover:opacity-90">Sign in <span aria-hidden="true">↗</span></Link> : null}
            </div>
            <dl className="mt-9 grid grid-cols-2 gap-3 border-t border-on-primary/15 pt-5 sm:grid-cols-3">
              <div><dt className="text-xs text-on-primary/60">Orders placed</dt><dd className="mt-1 font-headline text-2xl font-bold tabular-nums">{stats.orderCount}</dd></div>
              <div><dt className="text-xs text-on-primary/60">Lifetime spend</dt><dd className="mt-1 font-headline text-2xl font-bold tabular-nums">{stats.lifetimeSpend === null ? "Unavailable" : `${currency} ${stats.lifetimeSpend.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`}</dd></div>
              <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-on-primary/60">Average order</dt><dd className="mt-1 font-headline text-2xl font-bold tabular-nums">{stats.averageOrderValue === null ? "Unavailable" : `${currency} ${stats.averageOrderValue.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`}</dd></div>
            </dl>
          </section>

          <section id="orders" className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4 border-b border-outline-variant/15 pb-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Recent activity</p><h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">Order history</h2></div>
              <Link href="/shop" className="hidden min-h-11 items-center text-sm font-semibold text-primary hover:underline sm:inline-flex">Continue shopping ↗</Link>
            </div>
            {ordersError ? (
              <div className="space-y-3 py-8 text-sm text-error" role="alert">
                <p>{ordersError}</p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/account?retry=1" className="font-semibold underline">Retry order history</Link>
                  <Link href="/contact?topic=orders" className="font-semibold underline">Contact support</Link>
                </div>
              </div>
            ) : orders.length > 0 ? (
              <ul className="divide-y divide-outline-variant/15">
                {orders.map((order) => (
                  <li key={order.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-container-low text-primary"><span className="material-symbols-outlined text-[20px]">package_2</span></span>
                      <div><p className="text-sm font-semibold text-primary">Order #{order.displayId}</p><p className="mt-1 text-xs capitalize text-on-surface-variant">{order.itemCount} item{order.itemCount !== 1 ? "s" : ""} · {order.status.replace(/_/g, " ")} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : ""}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                      <p className="w-full text-sm font-semibold text-primary sm:w-auto">{order.currency} {order.total.toLocaleString("en-PH")}</p>
                      <Link href={"/account/orders/" + order.id} className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline">Details</Link>
                      {(() => {
                        const trackingUrl = buildTrackingUrl(
                          process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN,
                          order.id,
                          { customerEmail: user?.email ?? undefined, storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim() },
                        );
                        return trackingUrl ? (
                          <Link href={trackingUrl} className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline">Track</Link>
                        ) : null;
                      })()}
                      <Link href={"/account/orders/" + order.id + "/return"} className="inline-flex min-h-11 items-center text-xs text-on-surface-variant hover:underline">Return</Link>
                      {(order.status === "pending" || order.status === "pending_payment" || order.status === "requires_action") ? <OrderCancelButton orderId={order.id} orderDisplayId={order.displayId} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <div className="py-8 text-sm text-on-surface-variant">No orders yet. <Link href="/shop" className="font-semibold text-primary hover:underline">Start shopping</Link>.</div>}
          </section>

          {user ? (
            <section id="profile" className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 border-b border-outline-variant/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {profileAvatar ? <Image src={profileAvatar} alt="" width={64} height={64} className="size-16 rounded-2xl object-cover" referrerPolicy="no-referrer" unoptimized={shouldUnoptimizeImage(profileAvatar)} /> : <span className="grid size-16 place-items-center rounded-2xl bg-surface-container-low text-primary"><span className="material-symbols-outlined text-[28px]">person</span></span>}
                  <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Personal details</p><p className="mt-1 text-sm text-on-surface-variant">{user.email}</p></div>
                </div>
                <div className="flex items-center gap-4"><p className="max-w-xs text-xs leading-5 text-on-surface-variant">Keep your details current for smoother delivery and checkout.</p><SignOutButton /></div>
              </div>
              {profileResult.unavailable ? (
                <p className="mb-5 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error" role="alert">
                  Your profile is temporarily unavailable. No changes were saved. Refresh and try again.
                </p>
              ) : null}
              <AccountProfilePanel initial={{ displayName: profile?.displayName ?? null, phone: profile?.phone ?? null, avatarUrl: profile?.avatarUrl ?? null, shippingAddresses: profile?.shippingAddresses ?? [], updatedAt: profile?.updatedAt ?? null }} />
              <AccountPrivacyControls />
            </section>
          ) : <section className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-6"><p className="text-sm text-on-surface-variant">Sign in with Google to update your profile and save addresses.</p></section>}

          <section id="preferences" className="scroll-mt-28 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7">
            <div className="flex flex-col gap-2 border-b border-outline-variant/15 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Personalize</p><h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">Preferences</h2></div><Link href="/preferences" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">Open full settings ↗</Link></div>
            <div className="mt-6"><PreferencesControls /></div>
          </section>

          <section className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7">
            <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Order support</p><h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-primary">Track an order</h2><p className="mt-2 text-sm text-on-surface-variant">Paste the secure tracking link from your confirmation email.</p></div>
            <form action="/track" method="GET" className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input type="url" name="orderId" placeholder="https://…/track/cap_…" aria-label="Secure tracking link" className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:opacity-90">Track order</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
