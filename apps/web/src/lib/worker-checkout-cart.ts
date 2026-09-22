import type { CheckoutLine } from "./checkout-worker";
import { readResponseJson } from "./read-response-json";

/** Create a Worker-owned cart and populate it with checkout lines. */
export async function createWorkerCheckoutCart(
  baseUrl: string,
  lines: CheckoutLine[],
): Promise<string> {
  const cartResponse = await fetch(`${baseUrl}/store/carts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": `storefront-checkout-cart-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ currency_code: "php" }),
    cache: "no-store",
  });
  const cartPayload = await readResponseJson(cartResponse, {} as {
    cart?: { id?: unknown };
    error?: unknown;
  });
  const cartId =
    cartPayload.cart && typeof cartPayload.cart.id === "string"
      ? cartPayload.cart.id.trim()
      : "";
  if (!cartResponse.ok || !cartId) {
    throw new Error(
      typeof cartPayload.error === "string"
        ? cartPayload.error
        : "Worker checkout cart could not be created.",
    );
  }

  for (const line of lines) {
    const lineResponse = await fetch(
      `${baseUrl}/store/carts/${encodeURIComponent(cartId)}/line-items`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": `storefront-checkout-line-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          variant_id: line.variantId,
          quantity: line.quantity,
        }),
        cache: "no-store",
      },
    );
    if (!lineResponse.ok) {
      const linePayload = await readResponseJson(lineResponse, {} as { error?: unknown });
      throw new Error(
        typeof linePayload.error === "string"
          ? linePayload.error
          : "Worker checkout cart line could not be added.",
      );
    }
  }
  return cartId;
}
