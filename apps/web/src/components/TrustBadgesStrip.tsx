/**
 * Compact trust signals for PDP and other high-intent surfaces (no third-party logo assets).
 */
export function TrustBadgesStrip() {
  return (
    <div
      className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 px-4 py-4 sm:px-5"
      role="region"
      aria-label="Service information"
    >
      <ul className="grid gap-4 text-xs text-on-surface-variant sm:grid-cols-3 sm:gap-6">
        <li>
          <p className="font-headline font-bold uppercase tracking-wider text-primary">
            Secure checkout
          </p>
          <p className="mt-1 leading-relaxed">
            Payments are completed on your provider&apos;s encrypted page. We do
            not store full card numbers on this site.
          </p>
        </li>
        <li>
          <p className="font-headline font-bold uppercase tracking-wider text-primary">
            Nationwide shipping
          </p>
          <p className="mt-1 leading-relaxed">
            Couriers across the Philippines. Timelines vary by address; see
            shipping for estimates.
          </p>
        </li>
        <li>
          <p className="font-headline font-bold uppercase tracking-wider text-primary">
            Returns window
          </p>
          <p className="mt-1 leading-relaxed">
            Defective or wrong items: contact us promptly. Size exchanges may be
            available within 7 days for unworn goods. See returns policy.
          </p>
        </li>
      </ul>
    </div>
  );
}
