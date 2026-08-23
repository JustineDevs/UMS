import assert from "node:assert/strict";
import test from "node:test";
import { StyleManager } from "./style-manager";
import type { StyleElement } from "./style-manager";

function element(style: Record<string, string> = {}): StyleElement { return { parentElement: null, tagName: "DIV", id: "card", classList: [], style }; }

test("style manager writes responsive selector rules and regenerates CSS", () => {
  const manager = new StyleManager(); manager.setStyle(".card:hover", "color", "red"); manager.currentBreakpoint = "md"; manager.setStyle(".card", "display", "grid");
  assert.equal(manager.styles.none[".card:hover"]?.color, "red");
  assert.match(manager.cssText, /@media \(max-width: 767\.98px\)/);
  assert.equal(manager.getStyle(element(), "display"), "");
});

test("inline style wins and computed style is the final fallback", () => {
  const manager = new StyleManager(); const target = element({ color: "blue" });
  assert.equal(manager.setStyle(target, "color", "red"), target);
  assert.equal(target.style.color, "red");
  assert.equal(manager.getStyle(element(), "font-size", () => "16px"), "16px");
});
