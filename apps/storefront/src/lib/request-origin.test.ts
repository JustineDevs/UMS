import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginMutation } from "./request-origin";

test("same-origin mutation policy rejects explicit cross-site metadata", () => {
  assert.equal(
    isSameOriginMutation(new Request("https://store.test/api/account/profile", {
      headers: { origin: "https://evil.test" },
    })),
    false,
  );
  assert.equal(
    isSameOriginMutation(new Request("https://store.test/api/account/profile", {
      headers: { "sec-fetch-site": "cross-site" },
    })),
    false,
  );
  assert.equal(
    isSameOriginMutation(new Request("https://store.test/api/account/profile", {
      headers: { origin: "https://store.test" },
    })),
    true,
  );
  assert.equal(
    isSameOriginMutation(new Request("http://127.0.0.1:3000/api/checkout/start", {
      headers: { origin: "http://localhost:3000" },
    })),
    true,
  );
  assert.equal(
    isSameOriginMutation(new Request("https://127.0.0.1/api/account/profile", {
      headers: { origin: "https://evil.test" },
    })),
    false,
  );
});
