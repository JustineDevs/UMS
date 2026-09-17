import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("storefront metadata logo asset exists", () => {
  const assetPath = fileURLToPath(
    new URL("../public/brand/universal-music-store-logo-landscape.png", import.meta.url),
  );
  if (!existsSync(assetPath)) throw new Error(`Missing metadata logo: ${assetPath}`);
});
