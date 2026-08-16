import Medusa from "@medusajs/js-sdk";
import {
  getMedusaPublishableKey,
  getMedusaStoreBaseUrl,
} from "./storefront-medusa-env";

const MEDUSA_REQUEST_TIMEOUT_MS = 30_000;

export function createStorefrontMedusaSdk(options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Medusa {
  const baseUrl = getMedusaStoreBaseUrl();
  const publishableKey = getMedusaPublishableKey();
  if (!publishableKey) {
    throw new Error("Store publishable API key is not configured.");
  }
  const sdk = new Medusa({ baseUrl, publishableKey });
  const upstreamFetch = sdk.client.fetch_.bind(sdk.client);
  const timeoutMs = options?.timeoutMs ?? MEDUSA_REQUEST_TIMEOUT_MS;

  sdk.client.fetch_ = (input, init) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = options?.signal ?? init?.signal;
    const abort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    externalSignal?.addEventListener("abort", abort, { once: true });

    return upstreamFetch(input, { ...init, signal: controller.signal }).finally(
      () => {
        clearTimeout(timeout);
        externalSignal?.removeEventListener("abort", abort);
      },
    );
  };

  return sdk;
}
