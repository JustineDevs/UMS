import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedBrowserOrigin } from "./auth-callback-origin";

test("OAuth callback allows the explicit dev preview origin", () => {
  assert.equal(isAllowedBrowserOrigin("https://universalmusic-preview.vercel.app"), true);
  assert.equal(isAllowedBrowserOrigin("https://universalmusic.vercel.app"), true);
  assert.equal(isAllowedBrowserOrigin("https://evil.example"), false);
  assert.equal(isAllowedBrowserOrigin("https://universalmusic-preview.vercel.app.evil.example"), false);
});
