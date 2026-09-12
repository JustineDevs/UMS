import type { ComponentDefinition, ComponentRegistry, MatchableElement } from "./component-registry";
import type { DomEditorSession, DomMutation } from "./dom-command-engine";

export type Rect = { x: number; y: number; width: number; height: number };
export type BuilderNode = MatchableElement & { id: string; parentId: string | null; children: string[]; element?: HTMLElement };
export type ResizeHandle = "top-left" | "top" | "top-right" | "right" | "bottom-right" | "bottom" | "bottom-left" | "left";

export class BuilderController {
  selectedNodeId: string | null = null;
  highlightedNodeId: string | null = null;
  isDragging = false;
  isResizing = false;
  private readonly nodes = new Map<string, BuilderNode>();

  registerNode(node: BuilderNode): void { this.nodes.set(node.id, node); }
  selectNode(nodeId: string | null): BuilderNode | undefined { this.selectedNodeId = nodeId; return nodeId ? this.nodes.get(nodeId) : undefined; }
  inspectSelected(registry: ComponentRegistry): ComponentDefinition | undefined {
    const node = this.selectedNodeId ? this.nodes.get(this.selectedNodeId) : undefined;
    return node ? registry.matchNode(node) : undefined;
  }
  startDrag(): void { this.isDragging = true; }
  startResize(): void { this.isResizing = true; }
  endPointerInteraction(): void { this.isDragging = false; this.isResizing = false; }

  clone(nodeId: string, newId: string): BuilderNode {
    const source = this.nodes.get(nodeId); if (!source) throw new Error(`Unknown node: ${nodeId}`);
    const clone = { ...source, id: newId, children: [...source.children] }; this.nodes.set(newId, clone); return clone;
  }

  reorder(nodeId: string, parentId: string, index: number): DomMutation | null {
    const node = this.nodes.get(nodeId); if (!node) throw new Error(`Unknown node: ${nodeId}`);
    const oldParent = node.parentId; node.parentId = parentId;
    const parent = this.nodes.get(parentId); if (!parent) throw new Error(`Unknown parent: ${parentId}`);
    parent.children = parent.children.filter((id) => id !== nodeId); parent.children.splice(Math.max(0, Math.min(index, parent.children.length)), 0, nodeId);
    if (!node.element || !parent.element) return null;
    return {
      type: "move",
      node: node.element,
      beforeParent: node.element.parentElement ?? parent.element,
      beforeIndex: Math.max(0, Array.prototype.indexOf.call(node.element.parentElement?.children ?? [], node.element)),
      afterParent: parent.element,
      afterIndex: Math.max(0, index),
    };
  }

  reorderDom(nodeId: string, parentId: string, index: number, session: DomEditorSession): DomMutation {
    const node = this.nodes.get(nodeId);
    const parent = this.nodes.get(parentId);
    if (!node?.element || !parent?.element) throw new Error("DOM nodes are required for a DOM reorder");
    return session.move(node.element, parent.element, index);
  }
}

export function resizeRect(rect: Rect, handle: ResizeHandle, deltaX: number, deltaY: number): Rect {
  let { x, y, width, height } = rect;
  if (handle.includes("left")) { x += deltaX; width -= deltaX; }
  if (handle.includes("right")) width += deltaX;
  if (handle.includes("top")) { y += deltaY; height -= deltaY; }
  if (handle.includes("bottom")) height += deltaY;
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
}

export function commitDrag(
  node: BuilderNode,
  beforeParent: HTMLElement,
  afterParent: HTMLElement,
  beforeIndex: number,
  afterIndex: number,
): DomMutation {
  if (!node.element || !node.element.parentElement) throw new Error("DOM node is required for drag commit");
  if (beforeIndex < 0 || afterIndex < 0) throw new Error("Drag indexes must be non-negative");
  return {
    type: "move",
    node: node.element,
    beforeParent,
    beforeIndex,
    afterParent,
    afterIndex,
  };
}

export function commitDomDrag(
  node: HTMLElement,
  beforeParent: HTMLElement,
  beforeIndex: number,
  afterParent: HTMLElement,
  afterIndex: number,
  session: DomEditorSession,
): DomMutation {
  if (!node.parentElement || node.parentElement !== beforeParent) throw new Error("Drag source parent changed before commit");
  if (beforeIndex < 0 || afterIndex < 0) throw new Error("Drag indexes must be non-negative");
  return session.move(node, afterParent, afterIndex);
}
