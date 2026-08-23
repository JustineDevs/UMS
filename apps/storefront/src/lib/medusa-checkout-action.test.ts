import test from "node:test";
import assert from "node:assert/strict";
import {
  pickPaymentSessionForProvider,
  resolveCheckoutAction,
} from "./medusa-checkout-action";

test("pickPaymentSessionForProvider returns exact provider only", () => {
  const sessions = [
    { provider_id: "pp_stripe_stripe", id: "ps_1" },
    { provider_id: "pp_xendit_xendit", id: "ps_2" },
  ];
  assert.equal(
    pickPaymentSessionForProvider(sessions, "pp_xendit_xendit")?.id,
    "ps_2",
  );
  assert.equal(pickPaymentSessionForProvider(sessions, "pp_paypal_paypal"), null);
});

test("resolveCheckoutAction: COD manual", () => {
  const a = resolveCheckoutAction("pp_cod_cod", {
    id: "ps_cod",
    provider_id: "pp_cod_cod",
    data: {},
  });
  assert.equal(a.kind, "manual");
  if (a.kind === "manual") {
    assert.equal(a.paymentSessionId, "ps_cod");
  }
});

test("resolveCheckoutAction: data.cod manual", () => {
  const a = resolveCheckoutAction("pp_cod_cod", {
    id: "ps_x",
    provider_id: "pp_cod_cod",
    data: { cod: true },
  });
  assert.equal(a.kind, "manual");
});

test("resolveCheckoutAction: hosted https redirect (Xendit-style)", () => {
  const a = resolveCheckoutAction("pp_xendit_xendit", {
    id: "ps_p",
    provider_id: "pp_xendit_xendit",
    data: { checkout_url: "https://checkout.xendit.co/l/abc" },
  });
  assert.equal(a.kind, "redirect");
  if (a.kind === "redirect") {
    assert.ok(a.url.startsWith("https://"));
  }
});

test("resolveCheckoutAction: Stripe client_secret without hosted URL is unsupported", () => {
  const a = resolveCheckoutAction("pp_stripe_stripe", {
    id: "ps_s",
    provider_id: "pp_stripe_stripe",
    data: { client_secret: "sec_xxx" },
  });
  assert.equal(a.kind, "error");
});

test("resolveCheckoutAction: Stripe prefers hosted checkout_url over client_secret", () => {
  const a = resolveCheckoutAction("pp_stripe_stripe", {
    id: "ps_s",
    provider_id: "pp_stripe_stripe",
    data: {
      client_secret: "sec_xxx",
      checkout_url: "https://checkout.stripe.com/c/pay/cs_test",
      stripe_checkout_session_id: "cs_test",
    },
  });
  assert.equal(a.kind, "redirect");
  if (a.kind === "redirect") {
    assert.ok(a.url.includes("checkout.stripe.com"));
    assert.equal(a.providerPaymentId, "cs_test");
  }
});

test("resolveCheckoutAction: Stripe extracts hosted session id when metadata is omitted", () => {
  const a = resolveCheckoutAction("pp_stripe_stripe", {
    id: "ps_s",
    provider_id: "pp_stripe_stripe",
    data: { checkout_url: "https://checkout.stripe.com/c/pay/cs_from_url" },
  });
  assert.equal(a.kind, "redirect");
  if (a.kind === "redirect") assert.equal(a.providerPaymentId, "cs_from_url");
});

test("resolveCheckoutAction: PayPal embedded", () => {
  const a = resolveCheckoutAction("pp_paypal_paypal", {
    id: "ps_p",
    provider_id: "pp_paypal_paypal",
    data: { paypal_order_id: "ORDER" },
  });
  assert.equal(a.kind, "embedded");
});

test("resolveCheckoutAction: provider mismatch is error", () => {
  const a = resolveCheckoutAction("pp_stripe_stripe", {
    id: "x",
    provider_id: "pp_paypal_paypal",
    data: {},
  });
  assert.equal(a.kind, "error");
});

test("resolveCheckoutAction: missing https and no embedded is error", () => {
  const a = resolveCheckoutAction("pp_xendit_xendit", {
    id: "m",
    provider_id: "pp_xendit_xendit",
    data: { checkout_url: "http://insecure.example" },
  });
  assert.equal(a.kind, "error");
});

test("resolveCheckoutAction: wallet URL", () => {
  const a = resolveCheckoutAction("pp_test_wallet", {
    id: "w",
    provider_id: "pp_test_wallet",
    data: { wallet_url: "https://wallet.example/pay" },
  });
  assert.equal(a.kind, "wallet");
  if (a.kind === "wallet") assert.equal(a.url, "https://wallet.example/pay");
});

test("resolveCheckoutAction: qr payload", () => {
  const a = resolveCheckoutAction("pp_test_qr", {
    id: "q",
    provider_id: "pp_test_qr",
    data: { qr_code: "upi://pay" },
  });
  assert.equal(a.kind, "qr");
  if (a.kind === "qr") assert.equal(a.payload, "upi://pay");
});
