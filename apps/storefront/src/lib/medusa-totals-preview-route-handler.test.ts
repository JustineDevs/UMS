import assert from "node:assert/strict";
import test from "node:test";

import { handleMedusaTotalsPreviewRequest } from "./medusa-totals-preview-route-handler";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkout/medusa-totals-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("handleMedusaTotalsPreviewRequest accepts a validated guest email for card checkout", async () => {
  const res = await handleMedusaTotalsPreviewRequest(
    jsonRequest({
      lines: [{ variantId: "variant_1", quantity: 1 }],
      email: "guest@example.com",
    }),
    {
      getSessionEmail: async () => null,
      loadCustomerProfile: async () => null,
      isProfileComplete: () => false,
      listMissingProfileParts: () => [],
      profileToCodCartAddresses: () => null,
      executePreview: async () => ({
        subtotal: 100,
        taxTotal: 0,
        shippingTotal: 0,
        discountTotal: 0,
        total: 100,
        currencyCode: "PHP",
        lineSubtotalsByVariantId: { variant_1: 100 },
        quoteFingerprint: "guest-quote",
        variantIds: ["variant_1"],
        productIds: ["product_1"],
        shippingMethodIds: [],
        regionId: "region_1",
        shippingOptions: [],
        appliedShippingOptionId: null,
      }),
      logEvent: () => {},
    },
  );

  assert.equal(res.status, 200);
});

test("handleMedusaTotalsPreviewRequest rejects requests without valid lines", async () => {
  const res = await handleMedusaTotalsPreviewRequest(
    jsonRequest({
      lines: [
        { variantId: "   ", quantity: 1 },
        { variantId: "variant_1", quantity: 0 },
      ],
    }),
    {
      getSessionEmail: async () => "shopper@example.com",
      loadCustomerProfile: async () => null,
      isProfileComplete: () => false,
      listMissingProfileParts: () => [],
      profileToCodCartAddresses: () => null,
      executePreview: async () => {
        throw new Error("should not run");
      },
      logEvent: () => {},
    },
  );

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), {
    error: "Add at least one line item.",
  });
});

test("handleMedusaTotalsPreviewRequest returns profile gaps for COD previews", async () => {
  const profile = {
    displayName: "Shopper Example",
    phone: "+639171234567",
    avatarUrl: null,
    shippingAddresses: [],
  };
  const res = await handleMedusaTotalsPreviewRequest(
    jsonRequest({
      lines: [{ variantId: "variant_1", quantity: 2 }],
      paymentMethod: "COD",
    }),
    {
      getSessionEmail: async () => "shopper@example.com",
      loadCustomerProfile: async () => profile,
      isProfileComplete: () => false,
      listMissingProfileParts: () => ["mobile number", "delivery address"],
      profileToCodCartAddresses: () => null,
      executePreview: async () => {
        throw new Error("should not run");
      },
      logEvent: () => {},
    },
  );

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), {
    error: "Complete your delivery profile before previewing cash on delivery totals.",
    missingFields: ["mobile number", "delivery address"],
  });
});

test("handleMedusaTotalsPreviewRequest normalizes inputs and uses the standard preview flow", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const preview = {
    subtotal: 300,
    taxTotal: 36,
    shippingTotal: 10,
    discountTotal: 0,
    total: 346,
    currencyCode: "PHP",
    lineSubtotalsByVariantId: { variant_1: 300 },
    quoteFingerprint: "qf_1",
    variantIds: ["variant_1"],
    productIds: ["prod_1"],
    shippingMethodIds: ["ship_1"],
    regionId: "reg_1",
    shippingOptions: [
      {
        id: "ship_1",
        name: "Standard shipping",
        priceMajor: 10,
        currencyCode: "PHP",
      },
    ],
    appliedShippingOptionId: "ship_1",
  };

  const res = await handleMedusaTotalsPreviewRequest(
    jsonRequest({
      lines: [
        { variantId: " variant_1 ", quantity: 2.9 },
        { variantId: "variant_ignored", quantity: 0 },
      ],
      email: " alt@example.com ",
      loyaltyPointsToRedeem: 3.9,
      paymentMethod: "STRIPE",
    }),
    {
      getSessionEmail: async () => "shopper@example.com",
      loadCustomerProfile: async () => null,
      isProfileComplete: () => true,
      listMissingProfileParts: () => [],
      profileToCodCartAddresses: () => null,
      executePreview: async (input) => {
        calls.push(input as Record<string, unknown>);
        return preview;
      },
      logEvent: (event, payload) => {
        events.push({ event, payload });
      },
    },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), preview);
  assert.ok(calls[0]?.signal instanceof AbortSignal);
  delete calls[0]?.signal;
  assert.deepEqual(calls, [
    {
      lines: [{ variantId: "variant_1", quantity: 2 }],
      email: "alt@example.com",
      loyaltyPointsToRedeem: 3,
      shippingOptionId: undefined,
    },
  ]);
  assert.equal(events[0]?.event, "checkout_quote_generated");
  assert.deepEqual(events[0]?.payload, {
    quoteFingerprint: "qf_1",
    lineCount: 1,
    flow: "standard",
    actorEmail: "shopper@example.com",
  });
});

test("handleMedusaTotalsPreviewRequest uses the COD payload when the profile is complete", async () => {
  const preview = {
    subtotal: 300,
    taxTotal: 36,
    shippingTotal: 10,
    discountTotal: 0,
    total: 346,
    currencyCode: "PHP",
    lineSubtotalsByVariantId: { variant_1: 300 },
    quoteFingerprint: "qf_cod",
    variantIds: ["variant_1"],
    productIds: ["prod_1"],
    shippingMethodIds: ["ship_1"],
    regionId: "reg_1",
    shippingOptions: [
      {
        id: "ship_1",
        name: "Standard shipping",
        priceMajor: 10,
        currencyCode: "PHP",
      },
    ],
    appliedShippingOptionId: "ship_1",
  };
  const calls: Array<Record<string, unknown>> = [];
  const profile = {
    displayName: "Shopper Example",
    phone: "+639171234567",
    avatarUrl: null,
    shippingAddresses: [
      {
        fullName: "Shopper Example",
        phone: "+639171234567",
        line1: "1 Sample Street",
        barangay: "Central",
        city: "Quezon City",
        province: "Metro Manila",
        country: "PH",
        postalCode: "1100",
      },
    ],
  };
  const codCartPayload = {
    email: "shopper@example.com",
    shipping_address: {
      first_name: "Shopper",
      last_name: "Example",
      phone: "+639171234567",
      address_1: "1 Sample Street",
      address_2: "Barangay Central",
      city: "Quezon City",
      province: "metro manila",
      country_code: "ph",
      postal_code: "1100",
    },
    billing_address: {
      first_name: "Shopper",
      last_name: "Example",
      phone: "+639171234567",
      address_1: "1 Sample Street",
      address_2: "Barangay Central",
      city: "Quezon City",
      province: "metro manila",
      country_code: "ph",
      postal_code: "1100",
    },
  };

  const res = await handleMedusaTotalsPreviewRequest(
    jsonRequest({
      lines: [{ variantId: "variant_1", quantity: 1 }],
      paymentMethod: "cod",
    }),
    {
      getSessionEmail: async () => "shopper@example.com",
      loadCustomerProfile: async () => profile,
      isProfileComplete: () => true,
      listMissingProfileParts: () => [],
      profileToCodCartAddresses: (inputProfile, email) => {
        assert.equal(inputProfile, profile);
        assert.equal(email, "shopper@example.com");
        return codCartPayload;
      },
      executePreview: async (input) => {
        calls.push(input as Record<string, unknown>);
        return preview;
      },
      logEvent: () => {},
    },
  );

  assert.equal(res.status, 200);
  assert.ok(calls[0]?.signal instanceof AbortSignal);
  delete calls[0]?.signal;
  assert.deepEqual(calls, [
    {
      lines: [{ variantId: "variant_1", quantity: 1 }],
      loyaltyPointsToRedeem: undefined,
      shippingOptionId: undefined,
      codCartPayload,
    },
  ]);
});

test("handleMedusaTotalsPreviewRequest surfaces preview failures as 502 responses", async () => {
  const res = await handleMedusaTotalsPreviewRequest(
    jsonRequest({ lines: [{ variantId: "variant_1", quantity: 1 }] }),
    {
      getSessionEmail: async () => "shopper@example.com",
      loadCustomerProfile: async () => null,
      isProfileComplete: () => true,
      listMissingProfileParts: () => [],
      profileToCodCartAddresses: () => null,
      executePreview: async () => {
        throw new Error("MEDUSA_SECRET_API_KEY is not set");
      },
      logEvent: () => {},
    },
  );

  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), {
    error: "MEDUSA_SECRET_API_KEY is not set",
  });
});
