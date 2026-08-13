import Stripe from "stripe";

export type StripeCatalogSyncInput = {
  productId: string;
  title: string;
  description?: string | null;
  handle?: string | null;
  amountMinor: number;
  currency: string;
  siteOrigin?: string | null;
  includePaymentLink?: boolean;
  productExternalId?: string | null;
  priceExternalId?: string | null;
  paymentLinkExternalId?: string | null;
  idempotencyKey: string;
};

export type StripeCatalogSyncResult = {
  productId: string;
  priceId: string;
  paymentLinkId?: string;
  paymentLinkUrl?: string;
};

export async function archiveStripeCatalog(
  stripe: Stripe,
  input: {
    productExternalId?: string | null;
    priceExternalId?: string | null;
    paymentLinkExternalId?: string | null;
  },
): Promise<void> {
  if (input.paymentLinkExternalId) {
    await stripe.paymentLinks.update(input.paymentLinkExternalId, { active: false });
  }
  if (input.priceExternalId) {
    await stripe.prices.update(input.priceExternalId, { active: false });
  }
  if (input.productExternalId) {
    await stripe.products.update(input.productExternalId, { active: false });
  }
}

function normalizedCurrency(value: string): string {
  const currency = value.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("Stripe catalog currency must be ISO-4217");
  return currency;
}

export async function syncStripeCatalog(
  stripe: Stripe,
  input: StripeCatalogSyncInput,
): Promise<StripeCatalogSyncResult> {
  if (!input.productId.trim() || !input.title.trim()) throw new Error("Stripe catalog product identity is required");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 1) throw new Error("Stripe catalog amount must be a positive minor-unit integer");
  const currency = normalizedCurrency(input.currency);
  const product = input.productExternalId
    ? await stripe.products.update(input.productExternalId, {
        name: input.title.trim(),
        description: input.description?.trim() || undefined,
        metadata: { uvs_product_id: input.productId, handle: input.handle?.trim() || "" },
      })
    : await stripe.products.create(
        {
          name: input.title.trim(),
          description: input.description?.trim() || undefined,
          metadata: { uvs_product_id: input.productId, handle: input.handle?.trim() || "" },
        },
        { idempotencyKey: `${input.idempotencyKey}:product` },
      );

  let price: Stripe.Price | null = null;
  if (input.priceExternalId) {
    try {
      const existingPrice = await stripe.prices.retrieve(input.priceExternalId);
      if (
        existingPrice.active &&
        existingPrice.product === product.id &&
        existingPrice.currency === currency &&
        existingPrice.unit_amount === input.amountMinor
      ) {
        price = existingPrice;
      }
    } catch {
      // Recreate the projection when the external price was removed or archived.
    }
  }
  if (!price) {
    const previousPriceId = input.priceExternalId;
    price = await stripe.prices.create(
      {
        product: product.id,
        currency,
        unit_amount: input.amountMinor,
        metadata: { uvs_product_id: input.productId },
      },
      { idempotencyKey: `${input.idempotencyKey}:price:${input.amountMinor}:${currency}` },
    );
    if (previousPriceId && previousPriceId !== price.id) {
      try {
        await stripe.prices.update(previousPriceId, { active: false });
      } catch {
        // A stale price must not prevent the replacement artifact from being usable.
      }
    }
  }

  if (!input.includePaymentLink) return { productId: product.id, priceId: price.id };
  let paymentLink: Stripe.PaymentLink | null = null;
  if (input.paymentLinkExternalId && price.id === input.priceExternalId) {
    try {
      paymentLink = await stripe.paymentLinks.retrieve(input.paymentLinkExternalId);
    } catch {
      // Recreate a missing link below.
    }
  } else if (input.paymentLinkExternalId) {
    try {
      await stripe.paymentLinks.update(input.paymentLinkExternalId, { active: false });
    } catch {
      // A stale link should not prevent the new catalog artifact from being created.
    }
  }
  if (!paymentLink) {
    paymentLink = await stripe.paymentLinks.create(
        {
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: { uvs_product_id: input.productId },
          after_completion: input.siteOrigin?.startsWith("https://")
            ? { type: "redirect", redirect: { url: `${input.siteOrigin.replace(/\/$/, "")}/checkout/success` } }
            : { type: "hosted_confirmation" },
        },
        { idempotencyKey: `${input.idempotencyKey}:payment-link` },
      );
  }
  return {
    productId: product.id,
    priceId: price.id,
    paymentLinkId: paymentLink.id,
    paymentLinkUrl: paymentLink.url,
  };
}
