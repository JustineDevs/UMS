import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getChannelTenantKey } from "./channel-tenant-scope";

describe("channel tenant scope", () => {
  it("uses the configured integration key", () => {
    assert.equal(getChannelTenantKey({ CHANNEL_TENANT_KEY: "store-ph", NODE_ENV: "production" }), "store-ph");
  });

  it("fails closed in production when the key is absent or malformed", () => {
    assert.equal(getChannelTenantKey({ NODE_ENV: "production" }), null);
    assert.equal(getChannelTenantKey({ CHANNEL_TENANT_KEY: "store/ph", NODE_ENV: "production" }), null);
  });

  it("keeps the default only for local development", () => {
    assert.equal(getChannelTenantKey({ NODE_ENV: "development" }), "default");
  });
});
