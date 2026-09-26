"use client";

import Image from "next/image";
import { useState } from "react";
import type { PaymentProviderKey } from "@/lib/checkout-worker";

/** Official provider-hosted assets; do not replace these with approximated marks. */
const OFFICIAL_ASSETS: Partial<Record<PaymentProviderKey, string>> = {
  STRIPE:
    "https://images.stripeassets.com/fzn2n1nzq965/4M6d6BSWzlgsrJx8rdZb0I/733f37ef69b5ca1d3d33e127184f4ce4/Powered_by_Stripe.svg?q=80&w=1082",
  PAYPAL: "https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-200px.png",
  XENDIT: "https://www.xendit.co/wp-content/uploads/2020/03/XENDIT-LOGOArtboard-1%402x-1024x441.png",
};

export function PaymentProviderLogo({
  providerKey,
  label,
}: {
  providerKey: PaymentProviderKey;
  label: string;
}) {
  const src = OFFICIAL_ASSETS[providerKey];
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className="inline-flex h-8 min-w-[4.5rem] items-center justify-center rounded border border-outline-variant/30 bg-surface-container-high px-2 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant"
        aria-hidden
      >
        {label.slice(0, 18)}
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 items-center">
      <Image
        src={src}
        alt=""
        width={88}
        height={32}
        unoptimized
        className="h-8 w-auto max-w-[5.5rem] object-contain object-left"
        onError={() => setFailed(true)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
