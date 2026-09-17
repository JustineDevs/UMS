import assert from "node:assert/strict";
import test from "node:test";
import { BuilderController, resizeRect } from "./builder-controller";
import { ComponentRegistry } from "./component-registry";

test("builder controller selects and resolves the inspected component", () => {
  const registry = new ComponentRegistry(); const definition = registry.register("hero", { name: "Hero", nodes: ["section"] });
  const controller = new BuilderController(); controller.registerNode({ id: "hero-1", parentId: null, children: [], tagName: "section", attributes: [] });
  controller.selectNode("hero-1"); assert.equal(controller.inspectSelected(registry), definition);
});

test("resize state machine applies handle deltas with nonnegative dimensions", () => {
  assert.deepEqual(resizeRect({ x: 10, y: 10, width: 100, height: 80 }, "top-left", 20, 15), { x: 30, y: 25, width: 80, height: 65 });
  assert.equal(resizeRect({ x: 0, y: 0, width: 4, height: 4 }, "left", 10, 0).width, 0);
});

test("drag lifecycle exposes typed interaction state and clone/reorder operations", () => {
  const controller = new BuilderController(); controller.registerNode({ id: "root", parentId: null, children: ["a"], tagName: "main", attributes: [] }); controller.registerNode({ id: "a", parentId: "root", children: [], tagName: "div", attributes: [] });
  controller.startDrag(); controller.startResize(); assert.equal(controller.isDragging && controller.isResizing, true); controller.endPointerInteraction(); assert.equal(controller.isDragging, false);
  assert.equal(controller.clone("a", "b").id, "b"); controller.reorder("b", "root", 0); assert.deepEqual(controller.selectNode("root")?.children, ["b", "a"]);
});
