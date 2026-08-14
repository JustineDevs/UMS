"use strict";

/**
 * One JSON line per duplicate webhook delivery (audit: measure webhook duplicate rate).
 * Plain JS so tsx/node test runners on Windows resolve the module when parent `.ts` is loaded via require interop.
 * @param {"stripe" | "paypal" | "xendit"} provider
 * @param {string} dedupId
 */
function logWebhookDedupDuplicate(provider, dedupId) {
  const safeId =
    dedupId.length > 120 ? `${dedupId.slice(0, 40)}…${dedupId.slice(-40)}` : dedupId;
  console.info(
    JSON.stringify({
      event: "webhook_dedup_duplicate",
      provider,
      dedup_id: safeId,
      ts: new Date().toISOString(),
    }),
  );
}

module.exports = { logWebhookDedupDuplicate };
