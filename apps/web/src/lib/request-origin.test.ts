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
    isSameOriginMutation(new Request("http://127.0.0.1:3000/api/cart/reconcile", {
      headers: {
        origin: "http://localhost:3000",
        "sec-fetch-site": "cross-site",
      },
    })),
    true,
  );
  assert.equal(
    isSameOriginMutation(new Request("http://0.0.0.0:3000/api/checkout/preview", {
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

test("same-origin mutation policy accepts an explicitly configured HTTPS dev tunnel", () => {
  const previous = process.env.NEXT_ALLOWED_DEV_ORIGINS;
  process.env.NEXT_ALLOWED_DEV_ORIGINS = "cute-cases-thank.loca.lt";
  try {
    assert.equal(
      isSameOriginMutation(new Request("http://127.0.0.1:3000/api/cart/line", {
        headers: { origin: "https://cute-cases-thank.loca.lt" },
      })),
      true,
    );
    assert.equal(
      isSameOriginMutation(new Request("http://127.0.0.1:3000/api/cart/line", {
        headers: { origin: "https://evil.test" },
      })),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_ALLOWED_DEV_ORIGINS;
    else process.env.NEXT_ALLOWED_DEV_ORIGINS = previous;
  }
});

test("same-origin mutation policy rejects explicit cross-site requests", () => {
  const request = new Request("https://store.example/api/forms/contact", {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    },
  });
  assert.equal(isSameOriginMutation(request), false);
});
