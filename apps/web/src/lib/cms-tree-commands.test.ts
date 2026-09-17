import assert from "node:assert/strict";
import test from "node:test";
import { applyCmsMutation, createCmsHistory, moveCmsInstance, recordCmsCommand, redoCmsCommand, undoCmsCommand, validateCmsSlot } from "./cms-tree-commands";

const blocks = [{ id: "hero", type: "hero", componentId: "hero", props: {}, slots: { actions: [{ id: "cta", componentId: "cta-row", props: {}, slots: {} }] } }];

test("validates nested slots and rejects descendant moves", () => {
  assert.match(validateCmsSlot(blocks, "hero", "actions", { id: "x", componentId: "icon", props: {}, slots: {} }) ?? "", /does not allow/);
  const nested = [{ id: "outer", componentId: "two-column", props: {}, slots: { content: [{ id: "inner", componentId: "hero", props: {}, slots: {} }] } }];
  assert.match(validateCmsSlot([{ ...blocks[0], slots: { actions: nested } }], "inner", "actions", nested[0], "outer") ?? "", /descendant/);
});

test("command history undoes and redoes complete nested state", () => {
  const before = blocks;
  const after = [{ ...blocks[0], props: { title: "Changed" } }];
  const history = recordCmsCommand(createCmsHistory(), before, after);
  const undone = undoCmsCommand(history, after);
  assert.deepEqual(undone.state, before);
  const redone = redoCmsCommand(undone.history, before);
  assert.deepEqual(redone.state, after);
});

test("moves a nested instance between slots at the requested index", () => {
  const source = {
    id: "source",
    type: "hero",
    componentId: "hero",
    props: {},
    slots: { actions: [{ id: "cta-1", componentId: "cta-row", props: {}, slots: {} }] },
  };
  const target = {
    id: "target",
    type: "hero",
    componentId: "hero",
    props: {},
    slots: { actions: [{ id: "cta-2", componentId: "cta-row", props: {}, slots: {} }] },
  };
  const result = moveCmsInstance([source, target], "cta-1", "target", "actions", 0);
  assert.equal(result.error, null);
  assert.deepEqual(result.blocks[0].slots?.actions, []);
  assert.deepEqual(result.blocks[1].slots?.actions?.map((item) => item.id), ["cta-1", "cta-2"]);
});

test("replays persisted insert, remove, and move commands without snapshots", () => {
  const before = [
    { id: "hero", type: "hero", componentId: "hero", props: {}, slots: { actions: [] } },
    { id: "footer", type: "hero", componentId: "hero", props: {}, slots: { actions: [] } },
  ];
  const child = { id: "cta", componentId: "cta-row", props: {}, slots: {} };
  const inserted = [{ ...before[0], slots: { actions: [child] } }, before[1]];
  const insertHistory = recordCmsCommand(createCmsHistory(), before, inserted, { type: "insert", nodeId: "cta", parentId: "hero", slot: "actions", index: 0, node: child });
  assert.deepEqual(undoCmsCommand(insertHistory, inserted).state, before);
  assert.deepEqual(redoCmsCommand(undoCmsCommand(insertHistory, inserted).history, before).state, inserted);

  const moved = [before[0], { ...before[1], slots: { actions: [child] } }];
  const moveHistory = recordCmsCommand(createCmsHistory(), inserted, moved, { type: "move", nodeId: "cta", parentId: "footer", slot: "actions", index: 0 });
  assert.deepEqual(undoCmsCommand(moveHistory, moved).state, inserted);
  assert.deepEqual(redoCmsCommand(undoCmsCommand(moveHistory, moved).history, inserted).state, moved);
});

test("replays text, html, and attribute commands", () => {
  const before = [{ id: "hero", type: "hero", componentId: "hero", props: { title: "Before", html: "<p>Before</p>", attributes: {} }, slots: {} }];
  const text = applyCmsMutation(before, { type: "set-text", nodeId: "hero", key: "title", before: "Before", after: "After" }, "after");
  assert.equal(text?.[0].props.title, "After");
  const html = applyCmsMutation(text ?? before, { type: "set-html", nodeId: "hero", before: "<p>Before</p>", after: "<p>After</p>" }, "after");
  assert.equal(html?.[0].props.html, "<p>After</p>");
  const attribute = applyCmsMutation(html ?? before, { type: "set-attribute", nodeId: "hero", key: "aria-label", before: undefined, after: "Hero" }, "after");
  assert.equal((attribute?.[0].props.attributes as Record<string, unknown>)?.["aria-label"], "Hero");
});
