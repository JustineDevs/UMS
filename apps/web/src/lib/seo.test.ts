import test from "node:test";
import assert from "node:assert/strict";
import { serializeJsonLd } from "./seo";

test("serializeJsonLd escapes HTML-sensitive JSON-LD characters", () => {
  const serialized = serializeJsonLd({ description: "</script><script>alert(1)</script> &  " });
  assert.equal(serialized.includes("</script>"), false);
  assert.equal(serialized.includes("\\u003c/script\\u003e"), true);
  assert.equal(serialized.includes("\\u0026"), true);
  assert.equal(serialized.includes("\\u2028"), true);
  assert.equal(serialized.includes("\\u2029"), true);
});
