import assert from "node:assert/strict";
import test from "node:test";
import {
  handleWorkerWebhookRequest,
  verifyExactWebhookToken,
  verifyHmacSha256Base64,
  verifyHmacSha256Hex,
  verifyStripeSignature,
} from "./webhooks.ts";

test("verifies HMAC signatures without Node Buffer", async () => {
  const payload = '{"event":"paid"}';
  const secret = "webhook-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  const bytes = String.fromCharCode(...digest);
  const base64 = btoa(bytes);
  const hex = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  assert.equal(await verifyHmacSha256Hex(payload, hex, secret), true);
  assert.equal(await verifyHmacSha256Base64(payload, base64, secret), true);
  assert.equal(
    await verifyHmacSha256Hex(payload, `${hex.slice(0, -2)}00`, secret),
    false,
  );
});

test("accepts only an exact webhook token", () => {
  assert.equal(verifyExactWebhookToken("token", "token"), true);
  assert.equal(verifyExactWebhookToken("token-extra", "token"), false);
  assert.equal(verifyExactWebhookToken(null, "token"), false);
});

test("verifies Stripe v1 signatures and rejects replayed timestamps", async () => {
  const payload = '{"id":"evt_123"}';
  const secret = "whsec_test";
  const timestamp = 1_700_000_000;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`),
    ),
  );
  const signature = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(
    await verifyStripeSignature(payload, header, secret, {
      nowSeconds: timestamp + 60,
    }),
    true,
  );
  assert.equal(
    await verifyStripeSignature(payload, header, secret, {
      nowSeconds: timestamp + 301,
    }),
    false,
  );
  assert.equal(
    await verifyStripeSignature(payload, `t=${timestamp},v1=bad`, secret, {
      nowSeconds: timestamp,
    }),
    false,
  );
});

test("deduplicates verified Stripe webhook deliveries in the Worker database", async () => {
  const payload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = "whsec_test";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${payload}`),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  let insertCount = 0;
  const database = {
    query: async <T extends Record<string, unknown>>(
      text: string,
    ): Promise<{ rows: T[]; rowCount: number }> => {
      if (text.startsWith("INSERT INTO public.payment_webhook_events")) {
        insertCount += 1;
        return {
          rows: (insertCount === 1
            ? [{ inserted: true }]
            : []) as unknown as T[],
          rowCount: insertCount === 1 ? 1 : 0,
        };
      }
      if (text.startsWith("INSERT INTO public.worker_webhook_events")) {
        return { rows: [{ inserted: true }] as unknown as T[], rowCount: 1 };
      }
      if (text.startsWith("UPDATE public.payment_attempts")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error("unexpected query");
    },
    end: async () => undefined,
  };
  const request = () =>
    new Request("https://api.test/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    });
  const first = await handleWorkerWebhookRequest(
    request(),
    database,
    "stripe",
    { STRIPE_WEBHOOK_SECRET: secret },
  );
  const second = await handleWorkerWebhookRequest(
    request(),
    database,
    "stripe",
    { STRIPE_WEBHOOK_SECRET: secret },
  );
  assert.equal(first.status, 202);
  assert.equal(
    ((await first.json()) as { duplicate: boolean }).duplicate,
    false,
  );
  assert.equal(second.status, 202);
  assert.equal(
    ((await second.json()) as { duplicate: boolean }).duplicate,
    true,
  );
});

test("verifies PayPal webhook transmissions through PayPal's verification API", async () => {
  const calls: string[] = [];
  const database = {
    query: async <T extends Record<string, unknown>>(): Promise<{
      rows: T[];
      rowCount: number;
    }> => ({ rows: [{ inserted: true }] as unknown as T[], rowCount: 1 }),
    end: async () => undefined,
  };
  const response = await handleWorkerWebhookRequest(
    new Request("https://api.test/webhooks/paypal", {
      method: "POST",
      body: JSON.stringify({
        id: "WH-EVENT-1",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
      }),
      headers: {
        "paypal-transmission-id": "transmission-1",
        "paypal-transmission-time": "2026-09-11T00:00:00Z",
        "paypal-transmission-sig": "signature",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.paypal.com/cert.pem",
      },
    }),
    database,
    "paypal",
    {
      PAYPAL_CLIENT_ID: "client",
      PAYPAL_CLIENT_SECRET: "secret",
      PAYPAL_WEBHOOK_ID: "webhook",
      PAYPAL_FETCHER: async (input, init) => {
        calls.push(String(input));
        return calls.length === 1
          ? new Response(JSON.stringify({ access_token: "token" }), {
              status: 200,
            })
          : new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
              status: 200,
            });
      },
    },
  );
  assert.equal(response.status, 202);
  assert.deepEqual(calls, [
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
  ]);
});

test("accepts Xendit and Pancake callbacks only with their configured token", async () => {
  const database = {
    query: async <T extends Record<string, unknown>>(): Promise<{
      rows: T[];
      rowCount: number;
    }> => ({ rows: [{ inserted: true }] as unknown as T[], rowCount: 1 }),
    end: async () => undefined,
  };
  const xendit = await handleWorkerWebhookRequest(
    new Request("https://api.test/webhooks/xendit", {
      method: "POST",
      body: JSON.stringify({ id: "xendit-1" }),
      headers: { "x-callback-token": "x-token" },
    }),
    database,
    "xendit",
    { XENDIT_WEBHOOK_TOKEN: "x-token" },
  );
  const pancake = await handleWorkerWebhookRequest(
    new Request("https://api.test/webhooks/pancake", {
      method: "POST",
      body: JSON.stringify({ event_id: "pancake-1" }),
      headers: { Authorization: "Bearer pancake-token" },
    }),
    database,
    "pancake",
    { PANCAKE_POS_API_KEY: "pancake-token" },
  );
  const rejected = await handleWorkerWebhookRequest(
    new Request("https://api.test/webhooks/xendit", {
      method: "POST",
      body: JSON.stringify({ id: "xendit-2" }),
      headers: { "x-callback-token": "wrong" },
    }),
    database,
    "xendit",
    { XENDIT_WEBHOOK_TOKEN: "x-token" },
  );
  assert.equal(xendit.status, 202);
  assert.equal(pancake.status, 202);
  assert.equal(rejected.status, 401);
});

test("records provider-confirmed payment state only for a trusted attempt correlation", async () => {
  const queries: string[] = [];
  const jobs: unknown[] = [];
  const database = {
    query: async <T extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number }> => {
      queries.push(text);
      if (text.startsWith("INSERT INTO public.payment_webhook_events"))
        return { rows: [{ inserted: true }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.payment_attempts")) {
        assert.equal(values?.[0], "paid");
        assert.equal(values?.[4], "123e4567-e89b-12d3-a456-426614174000");
        assert.equal(values?.[5], "cs_123");
        return {
          rows: [{ correlation_id: "123e4567-e89b-12d3-a456-426614174000" }] as unknown as T[],
          rowCount: 1,
        };
      }
      if (text.startsWith("UPDATE public.payment_webhook_events"))
        return { rows: [], rowCount: 1 };
      if (text.startsWith("INSERT INTO public.worker_webhook_events"))
        return { rows: [{ inserted: true }] as unknown as T[], rowCount: 1 };
      throw new Error(`unexpected query: ${text}`);
    },
    end: async () => undefined,
  };
  const payload = JSON.stringify({
    id: "evt_trusted",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        metadata: { correlation_id: "123e4567-e89b-12d3-a456-426614174000" },
      },
    },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = "whsec_test";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`),
    ),
  );
  const signature = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const response = await handleWorkerWebhookRequest(
    new Request("https://api.test/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    }),
    database,
    "stripe",
    {
      STRIPE_WEBHOOK_SECRET: secret,
      COMMERCE_QUEUE: { send: async (job: unknown) => { jobs.push(job); } },
    },
  );
  assert.equal(response.status, 202);
  assert.equal(
    queries.some((query) => query.startsWith("UPDATE public.payment_attempts")),
    true,
  );
  assert.equal(jobs.length, 1);
});

test("keeps webhook lifecycle transitions monotonic and preserves cancellation", async () => {
  const queries: string[] = [];
  const database = {
    query: async <T extends Record<string, unknown>>(
      text: string,
    ): Promise<{ rows: T[]; rowCount: number }> => {
      queries.push(text);
      if (text.startsWith("INSERT INTO public.payment_webhook_events"))
        return { rows: [{ inserted: true }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.payment_attempts"))
        return {
          rows: [{ correlation_id: "123e4567-e89b-12d3-a456-426614174000" }] as unknown as T[],
          rowCount: 1,
        };
      if (text.startsWith("UPDATE public.payment_webhook_events"))
        return { rows: [], rowCount: 1 };
      if (text.startsWith("INSERT INTO public.worker_webhook_events"))
        return { rows: [{ inserted: true }] as unknown as T[], rowCount: 1 };
      throw new Error(`unexpected query: ${text}`);
    },
    end: async () => undefined,
  };
  const response = await handleWorkerWebhookRequest(
    new Request("https://api.test/webhooks/xendit", {
      method: "POST",
      body: JSON.stringify({
        id: "xendit-cancelled",
        status: "CANCELLED",
        reference_id: "123e4567-e89b-12d3-a456-426614174000",
      }),
      headers: { "x-callback-token": "x-token" },
    }),
    database,
    "xendit",
    { XENDIT_WEBHOOK_TOKEN: "x-token" },
  );
  assert.equal(response.status, 202);
  const update = queries.find((query) =>
    query.startsWith("UPDATE public.payment_attempts"),
  );
  assert.match(update ?? "", /'cancelled'/);
  assert.match(update ?? "", /status IN \('paid', 'completed', 'refunded'\)/);
});
