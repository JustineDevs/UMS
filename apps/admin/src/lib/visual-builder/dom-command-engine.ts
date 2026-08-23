import type { PropertyDefinition } from "./property-system";

export type DomMutation =
  | { type: "attribute"; target: HTMLElement; name: string; before: string | null; after: string | null }
  | { type: "style"; target: HTMLElement; name: string; before: string; after: string }
  | { type: "text" | "html"; target: HTMLElement; before: string; after: string }
  | { type: "insert"; parent: HTMLElement; node: HTMLElement; index: number }
  | { type: "remove"; parent: HTMLElement; node: HTMLElement; index: number }
  | { type: "move"; node: HTMLElement; beforeParent: HTMLElement; beforeIndex: number; afterParent: HTMLElement; afterIndex: number };

function insertAt(parent: HTMLElement, node: HTMLElement, index: number): void {
  if (node.parentElement === parent) parent.removeChild(node);
  const sibling = parent.children.item(Math.max(0, Math.min(index, parent.children.length)));
  parent.insertBefore(node, sibling);
}

export function applyDomMutation(mutation: DomMutation, direction: "before" | "after"): void {
  if (mutation.type === "attribute") {
    const value = direction === "before" ? mutation.before : mutation.after;
    if (value === null) mutation.target.removeAttribute(mutation.name);
    else mutation.target.setAttribute(mutation.name, value);
    return;
  }
  if (mutation.type === "style") {
    mutation.target.style.setProperty(mutation.name, direction === "before" ? mutation.before : mutation.after);
    return;
  }
  if (mutation.type === "text") {
    mutation.target.textContent = direction === "before" ? mutation.before : mutation.after;
    return;
  }
  if (mutation.type === "html") {
    mutation.target.innerHTML = direction === "before" ? mutation.before : mutation.after;
    return;
  }
  if (mutation.type === "insert") {
    if (direction === "before") mutation.node.remove();
    else insertAt(mutation.parent, mutation.node, mutation.index);
    return;
  }
  if (mutation.type === "remove") {
    if (direction === "before") insertAt(mutation.parent, mutation.node, mutation.index);
    else mutation.node.remove();
    return;
  }
  if (mutation.type === "move") {
    const parent = direction === "before" ? mutation.beforeParent : mutation.afterParent;
    const index = direction === "before" ? mutation.beforeIndex : mutation.afterIndex;
    insertAt(parent, mutation.node, index);
    return;
  }
}

export class DomCommandHistory {
  private readonly commands: DomMutation[] = [];
  private cursor = -1;

  add(command: DomMutation): void {
    this.commands.splice(this.cursor + 1);
    this.commands.push(command);
    this.cursor = this.commands.length - 1;
  }

  undo(): boolean {
    const command = this.commands[this.cursor];
    if (!command) return false;
    applyDomMutation(command, "before");
    this.cursor -= 1;
    return true;
  }

  redo(): boolean {
    const command = this.commands[this.cursor + 1];
    if (!command) return false;
    applyDomMutation(command, "after");
    this.cursor += 1;
    return true;
  }

  clear(): void { this.commands.length = 0; this.cursor = -1; }
  get canUndo(): boolean { return this.cursor >= 0; }
  get canRedo(): boolean { return this.cursor < this.commands.length - 1; }
}

export type DomSelection = { id: string; element: HTMLElement; rect: DOMRect };

export class DomEditorSession {
  readonly history = new DomCommandHistory();
  private selected: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private sequence = 0;

  constructor(private readonly document: Document) {}

  decorate(root: Document | HTMLElement = this.document.body): void {
    root.querySelectorAll<HTMLElement>("[data-uvs-editable], [data-cms-id]").forEach((node) => {
      if (!node.dataset.uvsId) node.dataset.uvsId = node.dataset.cmsId || `uvs-${++this.sequence}`;
    });
  }

  select(element: HTMLElement | null): DomSelection | null {
    this.selected = element;
    this.paintOverlay();
    if (!element) return null;
    const id = element.dataset.cmsId || element.dataset.uvsId || `uvs-${++this.sequence}`;
    element.dataset.uvsId = id;
    return { id, element, rect: element.getBoundingClientRect() };
  }

  get selection(): HTMLElement | null { return this.selected; }

  applyProperty(property: PropertyDefinition, value: unknown): DomMutation {
    const target = this.selected;
    if (!target) throw new Error("No selected element");
    const next = value == null ? "" : String(value);
    if (property.htmlAttr === "innerHTML") {
      const command: DomMutation = { type: "html", target, before: target.innerHTML, after: next };
      applyDomMutation(command, "after"); this.history.add(command); return command;
    }
    if (property.htmlAttr === "innerText") {
      const command: DomMutation = { type: "text", target, before: target.textContent ?? "", after: next };
      applyDomMutation(command, "after"); this.history.add(command); return command;
    }
    if (property.htmlAttr === "style") {
      const command: DomMutation = { type: "style", target, name: property.key, before: target.style.getPropertyValue(property.key), after: next };
      applyDomMutation(command, "after"); this.history.add(command); return command;
    }
    const name = property.htmlAttr || property.key;
    const command: DomMutation = { type: "attribute", target, name, before: target.getAttribute(name), after: next || null };
    applyDomMutation(command, "after"); this.history.add(command); return command;
  }

  insert(parent: HTMLElement, node: HTMLElement, index = parent.children.length): DomMutation {
    const command: DomMutation = { type: "insert", parent, node, index };
    applyDomMutation(command, "after"); this.history.add(command); return command;
  }

  remove(node: HTMLElement): DomMutation {
    const parent = node.parentElement;
    if (!parent) throw new Error("Cannot remove a detached element");
    const command: DomMutation = { type: "remove", parent, node, index: Array.prototype.indexOf.call(parent.children, node) };
    applyDomMutation(command, "after"); this.history.add(command); return command;
  }

  move(node: HTMLElement, parent: HTMLElement, index = parent.children.length): DomMutation {
    const beforeParent = node.parentElement;
    if (!beforeParent) throw new Error("Cannot move a detached element");
    const beforeIndex = Array.prototype.indexOf.call(beforeParent.children, node);
    const command: DomMutation = { type: "move", node, beforeParent, beforeIndex, afterParent: parent, afterIndex: index };
    applyDomMutation(command, "after"); this.history.add(command); return command;
  }

  clone(node: HTMLElement): HTMLElement {
    const parent = node.parentElement;
    if (!parent) throw new Error("Cannot clone a detached element");
    const clone = node.cloneNode(true) as HTMLElement;
    clone.dataset.uvsId = `uvs-${++this.sequence}`;
    this.insert(parent, clone, Array.prototype.indexOf.call(parent.children, node) + 1);
    return clone;
  }

  private paintOverlay(): void {
    this.overlay?.remove();
    if (!this.selected) { this.overlay = null; return; }
    const rect = this.selected.getBoundingClientRect();
    const overlay = this.document.createElement("div");
    overlay.dataset.uvsOverlay = "true";
    Object.assign(overlay.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: "none", outline: "2px solid #2563eb", zIndex: "2147483647" });
    const handle = this.document.createElement("div");
    handle.dataset.uvsHandle = "bottom-right";
    Object.assign(handle.style, { position: "absolute", right: "-5px", bottom: "-5px", width: "10px", height: "10px", border: "2px solid white", borderRadius: "999px", background: "#2563eb" });
    overlay.append(handle);
    this.document.body.append(overlay);
    this.overlay = overlay;
  }
}
