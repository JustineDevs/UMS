import type { Metadata } from "next";
import { AccountRouteFrame, AccountUnavailableState } from "@/components/AccountRouteFrame";

export const metadata: Metadata = { title: "My vouchers", robots: { index: false, follow: false } };

export default function AccountVouchersPage() {
  return (
    <AccountRouteFrame title="My Vouchers" description="Keep track of discounts available to your account.">
      <AccountUnavailableState title="No vouchers yet" message="Vouchers are not currently issued by the storefront. Any active promotions will be shown at checkout when eligible." actionHref="/shop" actionLabel="Browse the shop" />
    </AccountRouteFrame>
  );
}
