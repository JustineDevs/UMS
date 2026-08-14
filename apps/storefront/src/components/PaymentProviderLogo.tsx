"use client";

import Image from "next/image";
import { useState } from "react";
import type { PaymentProviderKey } from "@/lib/medusa-checkout";

/** Local SVGs in /public (Shopify payment_icons, MIT). */
const LOCAL: Partial<Record<PaymentProviderKey, string>> = {};

/** Brand marks via Simple Icons CDN (https://simpleicons.org). */
const CDN: Partial<Record<PaymentProviderKey, string>> = {
  STRIPE: "https://cdn.simpleicons.org/stripe/635BFF",
  PAYPAL: "https://cdn.simpleicons.org/paypal/00457C",
  XENDIT: "https://cdn.simpleicons.org/xendit/00B3B0",
};

export function PaymentProviderLogo({
  providerKey,
  label,
}: {
  providerKey: PaymentProviderKey;
  label: string;
}) {
  const src = LOCAL[providerKey] ?? CDN[providerKey];
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
