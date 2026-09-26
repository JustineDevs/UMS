import type { Metadata } from "next";
import { AccountRouteFrame, AccountUnavailableState } from "@/components/AccountRouteFrame";

export const metadata: Metadata = { title: "Banks & cards", robots: { index: false, follow: false } };

export default function AccountBanksCardsPage() {
  return (
    <AccountRouteFrame title="Banks & Cards" description="Review how payment details are handled for your purchases.">
      <AccountUnavailableState
        title="Payment details stay with the checkout provider"
        message="This store does not retain card or bank details in the customer account. Payment details are entered and protected by the selected checkout provider when you place an order."
        actionHref="/checkout"
        actionLabel="Go to checkout"
      />
    </AccountRouteFrame>
  );
}
