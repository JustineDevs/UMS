import Link from "next/link";

export function CheckoutTrustBadges() {
  return (
    <div className="mt-10 rounded-lg border border-outline-variant/15 bg-surface-container-low/50 px-4 py-6">
      <p className="font-headline text-xs font-bold uppercase tracking-widest text-primary mb-4">
        Policies and services
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm text-on-surface-variant">
        <li className="flex flex-col gap-1">
          <span className="font-medium text-primary">Secure payment</span>
          <span className="text-xs leading-relaxed">
            Card and wallet details are processed by your selected payment provider on their secure
            page.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-medium text-primary">Order tracking</span>
          <span className="text-xs leading-relaxed">
            Save your tracking link before paying so you can return without searching email.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-medium text-primary">Philippines shipping &amp; BOPIS</span>
          <span className="text-xs leading-relaxed">
            Nationwide couriers. Pickup in Cavite when offered on checkout or by arrangement.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-medium text-primary">Responsible packaging</span>
          <span className="text-xs leading-relaxed">
            We minimize excess packaging where we can. Materials vary by product and carrier.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-medium text-primary">Returns &amp; warranty</span>
          <span className="text-xs leading-relaxed">
            <Link href="/returns" className="underline hover:opacity-80">
              Return window
            </Link>
            {" · "}
            <Link href="/warranty" className="underline hover:opacity-80">
              Warranty info
            </Link>
          </span>
        </li>
      </ul>
    </div>
  );
}
