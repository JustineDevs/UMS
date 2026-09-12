import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentPlatformAlerts } from "./payment-supabase-bridge.ts";

const emptyMetrics = {
  paymentAttemptsStaleFinalize: 0,
  paymentAttemptsNeedsReview: 0,
  outboxPendingCount: 0,
  jobsQueuedCount: 0,
  jobsFailedRecentCount: 0,
  webhookEventsUnprocessed: 0,
  codDeliveredPendingCapture: 0,
  webhookSignatureFailures: 0,
  webhookDedupAnomalies: 0,
};

test("payment health stays quiet when all measured backlogs are empty", () => {
  assert.deepEqual(buildPaymentPlatformAlerts(emptyMetrics), []);
});

test("payment health emits critical alerts for stuck finalization and large webhook backlog", () => {
  const alerts = buildPaymentPlatformAlerts({
    ...emptyMetrics,
    paymentAttemptsStaleFinalize: 1,
    webhookEventsUnprocessed: 10,
    jobsFailedRecentCount: 2,
  });
  assert.deepEqual(alerts, [
    { code: "payment_attempts_stale_finalize", count: 1, severity: "critical" },
    { code: "payment_webhook_backlog", count: 10, severity: "critical" },
    { code: "background_job_failures", count: 2, severity: "critical" },
  ]);
});

test("small operational backlogs are warnings rather than hidden failures", () => {
  const alerts = buildPaymentPlatformAlerts({
    ...emptyMetrics,
    paymentAttemptsNeedsReview: 1,
    webhookEventsUnprocessed: 1,
    outboxPendingCount: 2,
    codDeliveredPendingCapture: 1,
  });
  assert.deepEqual(alerts.map(({ code, severity }) => ({ code, severity })), [
    { code: "payment_attempts_needs_review", severity: "warning" },
    { code: "payment_webhook_backlog", severity: "warning" },
    { code: "outbox_backlog", severity: "warning" },
    { code: "cod_capture_backlog", severity: "warning" },
  ]);
});

test("webhook security anomalies are surfaced with deterministic severity", () => {
  const alerts = buildPaymentPlatformAlerts({
    ...emptyMetrics,
    webhookSignatureFailures: 3,
    webhookDedupAnomalies: 1,
  });
  assert.deepEqual(alerts, [
    { code: "webhook_signature_failures", count: 3, severity: "critical" },
    { code: "webhook_dedup_anomalies", count: 1, severity: "warning" },
  ]);
});
