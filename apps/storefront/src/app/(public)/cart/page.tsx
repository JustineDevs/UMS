import type { Metadata } from "next";
import { CartPageClient } from "./cart-client";

export const metadata: Metadata = {
  title: "Cart",
};

export default function CartPage() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Your bag
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Review items before checkout. Prices update again at checkout with
        shipping and taxes.
      </p>
      <div className="mt-10">
        <CartPageClient />
      </div>
    </main>
  );
}
