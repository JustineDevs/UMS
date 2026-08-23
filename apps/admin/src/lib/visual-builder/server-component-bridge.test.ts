import assert from "node:assert/strict";
import test from "node:test";
import { acceptEditorSaveResponse, createEditorSaveRequest } from "./server-component-bridge";

test("server component bridge sanitizes HTML fields and validates optimistic saves", () => {
  const request = createEditorSaveRequest("product", "42", 7, [{ name: "content", value: "<p>ok</p><script>alert(1)</script>" }, { name: "price", value: "12\u0000" }]);
  assert.equal(request.expectedVersion, 7); assert.equal(request.fields[0].value.includes("script"), false); assert.equal(request.fields[1].value, "12");
  assert.deepEqual(acceptEditorSaveResponse({ html: "<p>ok</p>", version: 8, id: "42", component: "product" }).version, 8);
});
