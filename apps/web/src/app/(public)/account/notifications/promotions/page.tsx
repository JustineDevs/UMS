import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";
import { fetchFeaturedProducts } from "@/lib/catalog-fetch";

export const metadata: Metadata = {
  title: "Promotions",
  robots: { index: false, follow: false },
};

export default async function AccountPromotionsPage() {
  const session = await getStorefrontSession();
  const featured = session ? await fetchFeaturedProducts(6) : null;
  const products = featured?.kind === "ok" ? featured.products : [];

  return (
    <AccountRouteFrame title="Promotions" description="Discover store updates and offers for your next order.">
      {!session ? (
        <AccountSignInState message="Sign in to view promotions and store updates." />
      ) : (
        <section className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-lowest" aria-labelledby="promotions-heading">
          <h2 id="promotions-heading" className="sr-only">Promotions</h2>
          <div className="flex justify-end border-b border-outline-variant/15 px-6 py-3">
            <button type="button" disabled className="text-xs font-semibold text-on-surface-variant disabled:cursor-not-allowed">
              Mark all as read
            </button>
          </div>
          <div className="divide-y divide-outline-variant/15">
            {products.length > 0 ? products.map((product) => (
              <article key={product.id} className="flex items-start gap-4 bg-primary/[0.03] px-6 py-5 sm:gap-5">
                <div className="grid size-16 shrink-0 place-items-center rounded bg-primary text-on-primary">
                  <Tag className="size-7" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-primary">New gear available: {product.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">Explore this featured product and browse more instruments, studio essentials, and accessories in the store.</p>
                  <p className="mt-2 text-[11px] text-on-surface-variant">Store update</p>
                </div>
                <a href={`/shop/${product.slug}`} className="shrink-0 rounded border border-outline-variant/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-surface-container-low">View Details</a>
              </article>
            )) : (
              <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
                <div className="grid size-20 place-items-center rounded-full bg-surface-container-low text-primary"><Tag className="size-9" aria-hidden="true" /></div>
                <h3 className="mt-5 font-headline text-lg font-semibold text-primary">No Promotions yet</h3>
                <p className="mt-2 max-w-sm text-sm text-on-surface-variant">New store updates and eligible offers will appear here.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </AccountRouteFrame>
  );
}
