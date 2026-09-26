import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedBrowserOrigin, resolveAuthCallbackOrigin } from "./auth-callback-origin";

test("OAuth callback allows the explicit dev preview origin", () => {
  assert.equal(isAllowedBrowserOrigin("https://universalmusic-preview.vercel.app"), true);
  assert.equal(isAllowedBrowserOrigin("https://universalmusic.vercel.app"), true);
  assert.equal(isAllowedBrowserOrigin("https://evil.example"), false);
  assert.equal(isAllowedBrowserOrigin("https://universalmusic-preview.vercel.app.evil.example"), false);
});

test("preserves the trusted preview origin from the OAuth request", () => {
  assert.equal(
    resolveAuthCallbackOrigin(
      new Request("https://internal-vercel-origin.invalid/api/auth/callback"),
      "https://universalmusic-preview.vercel.app",
    ),
    "https://universalmusic-preview.vercel.app",
  );
});

test("uses the trusted forwarded preview host when the explicit origin is absent", () => {
  assert.equal(
    resolveAuthCallbackOrigin(
      new Request("https://internal-vercel-origin.invalid/api/auth/callback", {
        headers: {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "universalmusic-preview.vercel.app",
        },
      }),
      null,
    ),
    "https://universalmusic-preview.vercel.app",
  );
});
