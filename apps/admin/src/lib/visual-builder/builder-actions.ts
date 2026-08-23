export type Viewport = "desktop" | "tablet" | "mobile";

export function removeHelpers(html: string, keepHelperAttributes = false): string {
  let result = html
    .replace(/<[^>]+?data-uvs-helpers.+?>/gi, "")
    .replace(/<[^>]+?uvs-new-section.+?>.+?<\/newsection>/gims, "")
    .replaceAll("uvs-hidden", "")
    .replaceAll("data-uvsjs-editor", "");
  if (!keepHelperAttributes) result = result.replace(/\s+data-uvs-\w+(=["'].*?["'])?/gi, "");
  return result.replace(/\s+contenteditable(?:=["'][^"']*["'])?/gi, "").replace(/\s+spellcheckker(?:=["'][^"']*["'])?/gi, "");
}

export function serializeHtml(html: string, keepHelperAttributes = false): string {
  return removeHelpers(html.replace(/<script\b[^>]*src=["'](?:chrome|moz)-extension:\/\/[^>]*>[\s\S]*?<\/script>/gi, ""), keepHelperAttributes);
}

export function getDocumentTag(html: string, tag: "head" | "body"): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ?? html;
}

export class ViewportController {
  private viewport: Viewport = "desktop";
  set(viewport: Viewport): Viewport { this.viewport = viewport; return viewport; }
  get(): Viewport { return this.viewport; }
  className(): string { return this.viewport === "desktop" ? "" : this.viewport; }
}

export type Action = (...args: readonly unknown[]) => unknown;
export type Shortcut = { key: string; ctrlOrMeta?: boolean; shift?: boolean };

export class ActionRegistry {
  private readonly actions = new Map<string, Action>();
  private readonly shortcuts = new Map<string, string>();
  register(name: string, action: Action): void { this.actions.set(name, action); }
  bind(shortcut: Shortcut, actionName: string): void { this.shortcuts.set(this.shortcutKey(shortcut), actionName); }
  dispatch(name: string, ...args: readonly unknown[]): unknown { return this.actions.get(name)?.(...args); }
  dispatchShortcut(shortcut: Shortcut, ...args: readonly unknown[]): unknown {
    const action = this.shortcuts.get(this.shortcutKey(shortcut));
    return action ? this.dispatch(action, ...args) : undefined;
  }
  private shortcutKey(shortcut: Shortcut): string { return `${shortcut.ctrlOrMeta ? "mod+" : ""}${shortcut.shift ? "shift+" : ""}${shortcut.key.toLowerCase()}`; }
}
