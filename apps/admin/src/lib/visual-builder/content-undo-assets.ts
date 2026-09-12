export type ContentElement = {
  innerHTML: string;
  outerHTML: string;
  textContent: string | null;
  parentNode?: { replaceChild(next: ContentElement, current: ContentElement): void } | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export const ContentManager = {
  getAttr: (element: ContentElement, name: string) => element.getAttribute(name),
  setAttr: (element: ContentElement, name: string, value: string) => { element.setAttribute(name, value); return element; },
  getHtml: (element: ContentElement, outer = false) => outer ? element.outerHTML : element.innerHTML,
  setHtml: (element: ContentElement, html: string) => { element.innerHTML = html; return element; },
  getText: (element: ContentElement) => element.textContent,
  setText: (element: ContentElement, text: string) => { element.textContent = text; return element; },
};

export type Mutation =
  | { type: "childList"; target: NodeContainer; addedNodes: readonly NodeRef[]; removedNodes: readonly NodeRef[]; nextSibling?: NodeRef | null }
  | { type: "move"; target: NodeRef; oldParent: NodeContainer; oldNextSibling?: NodeRef | null; newParent: NodeContainer; newNextSibling?: NodeRef | null }
  | { type: "characterData"; target: ContentElement; oldValue: string; newValue: string }
  | { type: "style"; target: { textContent: string }; oldValue: string; newValue: string }
  | { type: "attributes"; target: ContentElement; attributeName: string; oldValue: string | null | undefined; newValue: string | number | boolean | null | undefined };

export type NodeRef = { parentNode: NodeContainer | null };
export type NodeContainer = { append(node: NodeRef): void; insertBefore(node: NodeRef, sibling: NodeRef): void; removeChild(node: NodeRef): void };

export function restoreMutation(mutation: Mutation, undo: boolean): void {
  if (mutation.type === "characterData") { mutation.target.innerHTML = undo ? mutation.oldValue : mutation.newValue; return; }
  if (mutation.type === "style") { mutation.target.textContent = undo ? mutation.oldValue : mutation.newValue; return; }
  if (mutation.type === "attributes") {
    const value = undo ? mutation.oldValue : mutation.newValue;
    if (mutation.attributeName === "innerHTML") { mutation.target.innerHTML = value == null ? "" : String(value); return; }
    if (mutation.attributeName === "innerText") { mutation.target.textContent = value == null ? "" : String(value); return; }
    value === null || value === undefined || value === "" ? mutation.target.removeAttribute(mutation.attributeName) : mutation.target.setAttribute(mutation.attributeName, String(value));
    return;
  }
  if (mutation.type === "move") {
    const parent = undo ? mutation.oldParent : mutation.newParent;
    const sibling = undo ? mutation.oldNextSibling : mutation.newNextSibling;
    if (sibling) sibling.parentNode?.insertBefore(mutation.target, sibling); else parent.append(mutation.target);
    return;
  }
  const added = undo ? mutation.removedNodes : mutation.addedNodes;
  const removed = undo ? mutation.addedNodes : mutation.removedNodes;
  for (const node of added) mutation.nextSibling ? mutation.target.insertBefore(node, mutation.nextSibling) : mutation.target.append(node);
  for (const node of removed) node.parentNode?.removeChild(node);
}

export class UndoStack {
  private readonly mutations: Mutation[] = [];
  private index = -1;
  add(mutation: Mutation): void { this.mutations.splice(++this.index, this.mutations.length - this.index, mutation); }
  undo(): void { if (this.index >= 0) restoreMutation(this.mutations[this.index--], true); }
  redo(): void { if (this.index < this.mutations.length - 1) restoreMutation(this.mutations[++this.index], false); }
  reset(): void { this.mutations.length = 0; this.index = -1; }
  hasChanges(): boolean { return this.mutations.length > 0; }
}

export type FontProvider = { addFont(font: string): void; removeFont(font: string): void };
export class FontAssetRegistry {
  private readonly providers = new Map<string, FontProvider>();
  private readonly active = new Map<string, { provider: string; font: string; element?: ContentElement }>();
  register(provider: string, implementation: FontProvider): void { this.providers.set(provider, implementation); }
  add(provider: string, font: string, element?: ContentElement): void {
    if (!provider) return;
    this.providers.get(provider)?.addFont(font);
    this.active.set(`${provider}:${font}:${this.active.size}`, { provider, font, element });
  }
  clean(isUsed: (element: ContentElement, font: string) => boolean): void {
    for (const [key, item] of this.active) if (item.element && !isUsed(item.element, item.font)) {
      this.providers.get(item.provider)?.removeFont(item.font);
      this.active.delete(key);
    }
  }
}

export class ColorPaletteStore {
  private readonly colors = new Map<string, string>();
  add(name: string, color: string): void { this.colors.set(name, color); }
  remove(name: string): void { this.colors.delete(name); }
  getAll(): ReadonlyMap<string, string> { return new Map(this.colors); }
}
