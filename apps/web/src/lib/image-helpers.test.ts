import assert from "node:assert/strict";
import test from "node:test";

import { isKnownUnavailableExternalImage } from "./image-helpers";

test("rejects URLs from the decommissioned catalog Supabase project", () => {
  assert.equal(
    isKnownUnavailableExternalImage(
      "https://gvsyfyaqxfrunoghgqiq.supabase.co/storage/v1/object/public/catalog/products/example.jpg",
    ),
    true,
  );
});

test("keeps URLs on the active Supabase project eligible", () => {
  assert.equal(
    isKnownUnavailableExternalImage(
      "https://dhqjriomusdrgdttxwhi.supabase.co/storage/v1/object/public/catalog/products/example.jpg",
    ),
    false,
  );
});
