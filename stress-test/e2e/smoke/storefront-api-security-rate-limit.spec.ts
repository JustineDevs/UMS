import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

const base =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/** RFC 5737 documentation range; stable IP key for IP-scoped rate limits (avoids clashing with parallel suites). */
const RL_TEST_FORWARDED_FOR = "203.0.113.79";

test.describe.configure({ mode: "serial" });

test.describe("attach-customer authorization precedence", () => {
  test("POST /api/cart/attach-customer keeps unauthenticated bursts at 401", async ({
    request,
  }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 26; i++) {
      const res = await request.post(`${base}/api/cart/attach-customer`, {
        data: {},
        failOnStatusCode: false,
        headers: {
          "X-Forwarded-For": RL_TEST_FORWARDED_FOR,
        },
      });
      statuses.push(res.status());
      expect(res.status()).toBe(401);
    }
    // The route intentionally authenticates before applying the IP bucket.
    // This prevents unauthenticated callers from turning a shared IP bucket
    // into an oracle for authenticated abuse state. Authenticated rate-limit
    // behavior is covered by the route-level limiter tests.
    expect(new Set(statuses)).toEqual(new Set([401]));
  });
});
