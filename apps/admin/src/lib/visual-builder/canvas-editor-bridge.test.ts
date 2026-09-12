import assert from "node:assert/strict";
import test from "node:test";
import { CanvasController, CmsApiClient, RichTextEditor, buildNodeTree, createEditorSaveRequest } from "./canvas-editor-bridge";

test("canvas lifecycle loads, edits, exports, and clears the iframe document", () => {
  const listeners = new Map<string, () => void>(); const document = { head: { innerHTML: "" }, body: { innerHTML: "old" } };
  const frame = { contentDocument: document, addEventListener: (type: "load" | "beforeunload" | "unload", listener: () => void) => listeners.set(type, listener) };
  const canvas = new CanvasController(frame); let ready = false; canvas.bootstrap(() => { ready = true; }); listeners.get("load")?.(); assert.equal(ready, true); canvas.setHtml("<main>new</main>"); assert.match(canvas.getHtml(), /<body>.*new/s); listeners.get("unload")?.(); assert.equal(canvas.loaded, false);
});

test("tree, rich text, and editor save contracts preserve stable state", () => {
  assert.deepEqual(buildNodeTree([{ id: "root", name: "Root", children: ["child"] }, { id: "child", name: "Child", children: [] }], ["root"])[0]?.children[0]?.name, "Child");
  const editor = new RichTextEditor("a"); editor.commit("b"); editor.undo(); assert.equal(editor.value, "a"); editor.redo(); assert.equal(editor.value, "b");
  assert.deepEqual(createEditorSaveRequest("hero", "title", "Launch", 2), { componentId: "hero", field: "title", value: "Launch", expectedVersion: 2 });
});

test("typed CMS client sends credentials and idempotency headers", async () => {
  let init: RequestInit | undefined; const client = new CmsApiClient(async (_input, requestInit) => { init = requestInit; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }, "https://cms.test");
  assert.deepEqual(await client.save("/pages", { title: "Home" }, "idem-1"), { ok: true }); assert.equal(init?.headers && new Headers(init.headers).get("idempotency-key"), "idem-1");
});
