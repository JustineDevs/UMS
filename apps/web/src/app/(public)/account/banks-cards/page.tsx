import type { Metadata } from "next";
import { AccountRouteFrame } from "@/components/AccountRouteFrame";
import { PaymentProviderLogo } from "@/components/PaymentProviderLogo";
import {
  PAYMENT_PROVIDER_LABELS,
  type PaymentProviderKey,
} from "@/lib/checkout-worker";

export const metadata: Metadata = { title: "Banks & cards", robots: { index: false, follow: false } };

const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentProviderKey, string> = {
  STRIPE: "Pay securely with a debit or credit card.",
  PAYPAL: "Use your PayPal balance or a card through PayPal.",
  XENDIT: "Choose GCash or a supported bank transfer option.",
  COD: "Pay in Philippine pesos when your order arrives.",
};

export default function AccountBanksCardsPage() {
  return (
    <AccountRouteFrame title="Payment methods" description="Choose how you want to pay during checkout.">
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          Object.keys(PAYMENT_PROVIDER_LABELS) as PaymentProviderKey[]
        ).map((provider) => (
          <PaymentMethodCard key={provider} provider={provider} />
        ))}
      </div>
      <p className="mt-5 max-w-2xl text-sm leading-6 text-on-surface-variant">
        Payment details are handled securely by the selected provider during
        checkout. This account area does not store card numbers, bank accounts,
        or wallet connections.
      </p>
    </AccountRouteFrame>
  );
}

function PaymentMethodCard({ provider }: { provider: PaymentProviderKey }) {
  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm sm:p-7">
      <div className="flex min-h-10 items-center">
        <PaymentProviderLogo
          providerKey={provider}
          label={PAYMENT_PROVIDER_LABELS[provider]}
        />
      </div>
      <h2 className="mt-5 font-headline text-lg font-bold text-primary">
        {PAYMENT_PROVIDER_LABELS[provider]}
      </h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-on-surface-variant">
        {PAYMENT_METHOD_DESCRIPTIONS[provider]}
      </p>
      <span className="mt-5 inline-flex rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
        Select during checkout
      </span>
    </section>
  );
}
