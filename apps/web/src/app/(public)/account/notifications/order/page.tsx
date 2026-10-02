import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Order Updates",
  robots: { index: false, follow: false },
};

export default async function AccountOrderUpdatesPage() {
  const session = await getStorefrontSession();

  return (
    <AccountRouteFrame title="Order Updates" description="Track notifications about your orders and deliveries.">
      {!session ? (
        <AccountSignInState message="Sign in to view your order updates." />
      ) : (
        <section className="flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-8 text-center" aria-labelledby="order-updates-empty-heading">
          <div className="grid size-20 place-items-center rounded-full bg-surface-container-low text-primary">
            <Bell className="size-9" aria-hidden="true" />
          </div>
          <h2 id="order-updates-empty-heading" className="mt-5 font-headline text-lg font-semibold text-primary">
            No Order Updates yet
          </h2>
          <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
            New order confirmations, shipping updates, and delivery notices will appear here.
          </p>
        </section>
      )}
    </AccountRouteFrame>
  );
}
