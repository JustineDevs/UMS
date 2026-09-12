import assert from "node:assert/strict";
import test from "node:test";
import { handlePaymentMethodsRequest } from "./payment-methods.ts";

test("payment capabilities expose configured providers without secrets", async () => {
  const response = await handlePaymentMethodsRequest(new Request("https://api.test/store/payment-methods"), {
    STRIPE_API_KEY: "sk_test",
    PAYPAL_CLIENT_ID: "client",
    PAYPAL_CLIENT_SECRET: "secret",
    XENDIT_SECRET_KEY: "xnd_secret",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
      ok: true,
      keys: ["STRIPE", "PAYPAL", "XENDIT", "COD"],
      code: "ok",
      error: null,
      message: null,
  });
});

test("payment capabilities never enable provider without its credentials", async () => {
  const response = await handlePaymentMethodsRequest(new Request("https://api.test/store/payment-methods"), {
    STRIPE_API_KEY: "",
    PAYPAL_CLIENT_ID: "client",
    XENDIT_SECRET_KEY: "secret",
  });
  assert.deepEqual(await response.json(), {
    ok: true,
    keys: ["XENDIT", "COD"],
    code: "ok",
    error: null,
    message: null,
  });
});
