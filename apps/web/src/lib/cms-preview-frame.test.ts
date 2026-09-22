import assert from "node:assert/strict";
import test from "node:test";
import {
  cmsPreviewSandbox,
  cmsPreviewTargetOrigin,
  isCmsPreviewMessageFromFrame,
} from "./cms-preview-frame";

test("storefront preview keeps a real origin only across the admin boundary", () => {
  assert.equal(
    cmsPreviewSandbox("https://store.test", "https://admin.test"),
    "allow-scripts allow-same-origin",
  );
  assert.equal(
    cmsPreviewSandbox("https://admin.test", "https://admin.test"),
    "allow-scripts",
  );
  assert.equal(cmsPreviewSandbox("", "https://admin.test"), "allow-scripts");
});

function frame(sandbox: string | null) {
  const attributes = new Map(sandbox === null ? [] : [["sandbox", sandbox]]);
  return {
    contentWindow: {} as Window,
    hasAttribute: (name: string) => attributes.has(name),
    getAttribute: (name: string) => attributes.get(name) ?? null,
  } as unknown as HTMLIFrameElement;
}

test("opaque CMS preview frames use wildcard target origin", () => {
  assert.equal(cmsPreviewTargetOrigin(frame("allow-scripts"), "https://store.test"), "*");
  assert.equal(cmsPreviewTargetOrigin(frame(null), "https://store.test"), "https://store.test");
});

test("preview bridge accepts opaque origin only from the exact sandboxed frame", () => {
  const preview = frame("allow-scripts");
  const source = preview.contentWindow;
  assert.equal(isCmsPreviewMessageFromFrame({ source, origin: "null" }, preview, "https://store.test"), true);
  assert.equal(isCmsPreviewMessageFromFrame({ source: {} as Window, origin: "null" }, preview, "https://store.test"), false);
  assert.equal(isCmsPreviewMessageFromFrame({ source, origin: "https://attacker.test" }, preview, "https://store.test"), false);
});

test("same-origin sandbox frames do not receive opaque-origin exceptions", () => {
  const preview = frame("allow-scripts allow-same-origin");
  assert.equal(isCmsPreviewMessageFromFrame({ source: preview.contentWindow, origin: "null" }, preview, "https://store.test"), false);
  assert.equal(isCmsPreviewMessageFromFrame({ source: preview.contentWindow, origin: "https://store.test" }, preview, "https://store.test"), true);
});
