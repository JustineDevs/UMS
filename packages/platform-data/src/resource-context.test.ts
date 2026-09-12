import assert from "node:assert/strict";
import test from "node:test";
import { authorizeResourceContext, resourceContextAllows } from "./resource-context.js";

const grant = {
  staffId: "staff-1", tenantId: "tenant-a", storeId: "store-a", channelId: "web",
  provider: "Stripe", permission: "payments:write",
};

test("resource context requires the same tenant, store, channel, and provider", () => {
  assert.equal(resourceContextAllows(grant, { staffId: "staff-1", tenantId: "tenant-a", storeId: "store-a", channelId: "web", provider: "stripe" }, "payments:write"), true);
  assert.equal(resourceContextAllows(grant, { staffId: "staff-1", tenantId: "tenant-b", storeId: "store-a", channelId: "web", provider: "stripe" }, "payments:write"), false);
  assert.equal(resourceContextAllows(grant, { staffId: "staff-1", tenantId: "tenant-a", storeId: "store-b", channelId: "web", provider: "stripe" }, "payments:write"), false);
  assert.equal(resourceContextAllows(grant, { staffId: "staff-2", tenantId: "tenant-a", storeId: "store-a", channelId: "web", provider: "stripe" }, "payments:write"), false);
  assert.equal(resourceContextAllows(grant, { staffId: "staff-1", tenantId: "tenant-a", storeId: "store-a", channelId: "web", provider: "paypal" }, "payments:write"), false);
});

test("wildcard dimensions are explicit and permissions remain deny-by-default", () => {
  const wildcard = { ...grant, storeId: null, channelId: null, provider: null };
  assert.equal(resourceContextAllows(wildcard, { staffId: "staff-1", tenantId: "tenant-a", storeId: "store-b", channelId: "pos", provider: "paypal" }, "payments:write"), true);
  assert.equal(resourceContextAllows(wildcard, { staffId: "staff-1", tenantId: "tenant-a", storeId: "store-b", channelId: "pos", provider: "paypal" }, "payments:read"), false);
  assert.equal(authorizeResourceContext([grant], { staffId: "staff-1", tenantId: "tenant-a", storeId: "store-a", channelId: "web", provider: "stripe" }, "payments:read"), null);
});
