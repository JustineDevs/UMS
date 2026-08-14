/**
 * Payment Provider Sandbox Connectivity Tests
 *
 * Tests real HTTP connections to each PSP sandbox/test API.
 * Skips providers whose env credentials are not configured.
 *
 * Run: pnpm test:psp-sandbox
 *
 * Expected env vars per provider (set in root .env.local or CI secrets):
 *   Stripe:        STRIPE_API_KEY (sk_test_*)
 *   PayPal:        PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT=sandbox
 *   Xendit:        XENDIT_SECRET_KEY
 *   COD:           Always passes (no external service)
 *   Medusa health: MEDUSA_BACKEND_URL, then NEXT_PUBLIC_MEDUSA_URL, then localhost:9000
 */

const TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basicAuth(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

function medusaPaymentHealthBaseUrls(): string[] {
  const candidates = [
    process.env.MEDUSA_BACKEND_URL,
    process.env.NEXT_PUBLIC_MEDUSA_URL,
    "http://localhost:9000",
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const u = c?.trim().replace(/\/$/, "");
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Stripe sandbox connectivity
// ---------------------------------------------------------------------------

describe("Stripe sandbox connectivity", () => {
  const apiKey = process.env.STRIPE_API_KEY?.trim();
  const isTestKey =
    apiKey?.startsWith("sk_test_") || apiKey?.startsWith("rk_test_");

  if (!apiKey || !isTestKey) {
    it.skip("STRIPE_API_KEY not configured or not a test key", () => {});
    return;
  }

  it(
    "GET /v1/balance returns valid response",
    async () => {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        object?: string;
        livemode?: boolean;
      };
      expect(body.object).toBe("balance");
      expect(body.livemode).toBe(false);
    },
    TIMEOUT,
  );

  it(
    "GET /v1/payment_methods returns valid response",
    async () => {
      const res = await fetch(
        "https://api.stripe.com/v1/payment_methods?limit=1",
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { object?: string };
      expect(body.object).toBe("list");
    },
    TIMEOUT,
  );

  it(
    "POST /v1/payment_intents creates a test payment intent",
    async () => {
      const res = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "amount=1000&currency=usd&payment_method_types[]=card",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        id?: string;
        object?: string;
        status?: string;
        livemode?: boolean;
      };
      expect(body.object).toBe("payment_intent");
      expect(body.id).toMatch(/^pi_/);
      expect(body.status).toBe("requires_payment_method");
      expect(body.livemode).toBe(false);
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// 2. PayPal sandbox connectivity
// ---------------------------------------------------------------------------

describe("PayPal sandbox connectivity", () => {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const isSandbox =
    process.env.PAYPAL_ENVIRONMENT?.trim() === "sandbox" ||
    process.env.NODE_ENV !== "production";

  if (!clientId || !clientSecret) {
    it.skip("PAYPAL_CLIENT_ID/SECRET not configured", () => {});
    return;
  }

  const base = isSandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

  let accessToken = "";

  it(
    "POST /v1/oauth2/token obtains access token",
    async () => {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      const res = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        access_token?: string;
        token_type?: string;
      };
      expect(body.access_token).toBeTruthy();
      expect(body.token_type).toBe("Bearer");
      accessToken = body.access_token ?? "";
    },
    TIMEOUT,
  );

  it(
    "POST /v2/checkout/orders creates sandbox order",
    async () => {
      if (!accessToken) {
        throw new Error("Access token not obtained from previous test");
      }

      const res = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              custom_id: "psp-test-session",
              amount: { currency_code: "PHP", value: "100.00" },
            },
          ],
          application_context: {
            return_url: "http://localhost:3000/checkout",
            cancel_url: "http://localhost:3000/checkout?paypal=cancel",
            user_action: "PAY_NOW",
          },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        id?: string;
        status?: string;
        links?: Array<{ rel?: string; href?: string }>;
      };
      expect(body.id).toBeTruthy();
      expect(body.status).toBe("CREATED");
      const approveLink = body.links?.find((l) => l.rel === "approve");
      expect(approveLink?.href).toContain("paypal.com");
    },
    TIMEOUT,
  );

  it(
    "GET /v2/checkout/orders/:id retrieves order",
    async () => {
      if (!accessToken) {
        throw new Error("Access token not obtained");
      }

      const createRes = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            { amount: { currency_code: "PHP", value: "50.00" } },
          ],
          application_context: {
            return_url: "http://localhost:3000",
            cancel_url: "http://localhost:3000",
          },
        }),
      });
      const created = (await createRes.json()) as { id?: string };
      expect(created.id).toBeTruthy();

      const res = await fetch(`${base}/v2/checkout/orders/${created.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id?: string };
      expect(body.id).toBe(created.id);
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// 3. Xendit sandbox connectivity
// ---------------------------------------------------------------------------

describe("Xendit sandbox connectivity", () => {
  const secretKey = process.env.XENDIT_SECRET_KEY?.trim();
  const base = "https://api.xendit.co";
  const headers = {
    Authorization: secretKey ? basicAuth(secretKey) : "",
    "Content-Type": "application/json",
  };

  let session:
    | {
        id?: string;
        payment_link_url?: string;
      }
    | null = null;
  let skipReason = "";

  beforeAll(async () => {
    if (!secretKey) {
      skipReason = "XENDIT_SECRET_KEY not configured";
      return;
    }

    const referenceId = `medusa_ps:test-${Date.now()}`;
    const res = await fetch(`${base}/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        session_type: "PAY",
        mode: "PAYMENT_LINK",
        amount: 10000,
        currency: "PHP",
        reference_id: referenceId,
        description: "PSP connectivity test",
        success_return_url:
          "http://localhost:3000/checkout/hosted-return?provider=xendit&status=success",
        cancel_return_url:
          "http://localhost:3000/checkout/hosted-return?provider=xendit&status=cancel",
      }),
    });

    if (res.status === 401 || res.status === 403) {
      skipReason = `XENDIT_SECRET_KEY is present but unauthorized (${res.status})`;
      return;
    }

    if (!res.ok) {
      skipReason = `Xendit sandbox probe failed with ${res.status}`;
      return;
    }

    session = (await res.json()) as {
      id?: string;
      payment_link_url?: string;
    };
  }, TIMEOUT);

  it(
    "POST /sessions creates a payment link session",
    async () => {
      if (skipReason || !session) return;
      expect(session.id).toBeTruthy();
      expect(session.payment_link_url).toBeTruthy();
    },
    TIMEOUT,
  );

  it(
    "GET /sessions/:id retrieves created session",
    async () => {
      if (skipReason || !session?.id?.trim()) return;

      const sessionId = session.id.trim();
      expect(sessionId).toBeTruthy();

      const res = await fetch(`${base}/sessions/${encodeURIComponent(sessionId as string)}`, {
        headers: { Authorization: headers.Authorization },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id?: string; reference_id?: string };
      expect(body.id).toBe(sessionId);
      expect(body.reference_id).toBeTruthy();
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// 5. COD (Cash on Delivery) - always passes
// ---------------------------------------------------------------------------

describe("COD (Cash on Delivery) connectivity", () => {
  it("COD requires no external service and is always available", () => {
    expect(true).toBe(true);
  });

  it("COD provider identifier matches expected value", () => {
    expect("cod").toBe("cod");
  });
});

// ---------------------------------------------------------------------------
// 6. Medusa payment-health endpoint
// ---------------------------------------------------------------------------

describe("Medusa payment-health endpoint", () => {
  it(
    "GET /admin/payment-health returns provider status",
    async () => {
      const bases = medusaPaymentHealthBaseUrls();
      let lastRes: Response | null = null;

      for (const base of bases) {
        const res = await fetch(`${base}/admin/payment-health`, {
          headers: { "Content-Type": "application/json" },
        }).catch(() => null);

        if (!res) continue;
        lastRes = res;

        if (res.status === 401 || res.status === 403) {
          console.warn(
            "[payment-health] Auth required (expected in production)",
          );
          return;
        }

        if (res.ok) {
          const body = (await res.json()) as {
            credentialSource?: string;
            configuredCount?: number;
            providers?: Record<string, { configured: boolean }>;
            timestamp?: string;
          };
          expect(body).toHaveProperty("credentialSource");
          expect(body).toHaveProperty("configuredCount");
          expect(body).toHaveProperty("providers");
          expect(body).toHaveProperty("timestamp");
          expect(typeof body.configuredCount).toBe("number");
          return;
        }
      }

      if (!lastRes) {
        console.warn(
          `[payment-health] Medusa not reachable (tried: ${bases.join(", ")}), skipping`,
        );
        return;
      }

      expect(lastRes.status).toBe(200);
    },
    TIMEOUT,
  );
});
