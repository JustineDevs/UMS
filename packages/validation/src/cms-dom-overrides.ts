import { parseDocument } from "htmlparser2";

type ParsedNode = {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: ParsedNode[];
};

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const EDITABLE_STYLES = new Set([
  "display", "position", "width", "height", "margin", "padding", "color", "background-color", "font-size", "font-weight",
  "border-radius", "gap", "align-items", "justify-content", "grid-template-columns", "min-width", "max-width", "min-height",
  "max-height", "line-height", "letter-spacing", "border", "box-shadow", "object-fit", "object-position", "background-size", "background-position",
]);

function safeUrl(value: string) {
  return !value.startsWith("//") && /^(?:https?:|mailto:|tel:|\/|#|$)/i.test(value);
}

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function elementChildren(node: ParsedNode): ParsedNode[] {
  return (node.children ?? []).filter((child) => child.type === "tag");
}

function nodeAtPath(root: ParsedNode, path: number[]) {
  let current: ParsedNode | undefined = root;
  for (const index of path) {
    current = current ? elementChildren(current)[index] : undefined;
    if (!current) return undefined;
  }
  return current;
}

function applyOverride(node: ParsedNode, overrides: Record<string, unknown>) {
  for (const [property, rawValue] of Object.entries(overrides)) {
    if (typeof rawValue !== "string" || rawValue.length > 100_000) continue;
    const value = rawValue.replace(/[{}<>]/g, "");
    const name = node.name?.toLowerCase() ?? "";
    if (property === "textContent" && elementChildren(node).length === 0) {
      node.children = [{ type: "text", data: value }];
    } else if (property === "href" && name === "a" && safeUrl(value)) {
      node.attribs = { ...(node.attribs ?? {}), href: value };
    } else if (property === "src" && (name === "img" || name === "video") && safeUrl(value)) {
      node.attribs = { ...(node.attribs ?? {}), src: value };
    } else if (property.startsWith("style.")) {
      const styleProperty = property.slice(6) === "font-color" ? "color" : property.slice(6);
      if (!EDITABLE_STYLES.has(styleProperty) || /[;{}<>]/.test(value) || /url\s*\(/i.test(value)) continue;
      const declarations = (node.attribs?.style ?? "").split(";").map((entry) => entry.trim()).filter(Boolean).filter((entry) => !entry.toLowerCase().startsWith(`${styleProperty}:`));
      declarations.push(`${styleProperty}:${value}`);
      node.attribs = { ...(node.attribs ?? {}), style: declarations.join(";") };
    }
  }
}

function serialize(node: ParsedNode): string {
  if (node.type === "text") return escapeText(node.data ?? "");
  if (node.type === "comment") return `<!--${node.data ?? ""}-->`;
  if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return (node.children ?? []).map(serialize).join("");
  const name = node.name ?? "div";
  const attributes = Object.entries(node.attribs ?? {}).map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join("");
  if (VOID_TAGS.has(name.toLowerCase())) return `<${name}${attributes}>`;
  return `<${name}${attributes}>${(node.children ?? []).map(serialize).join("")}</${name}>`;
}

/** Applies persisted Vvveb child mutations using the same element-relative paths as the editor bridge. */
export function applyCmsDomOverrides(markup: string, overrides: Record<string, Record<string, unknown>>): string {
  if (!markup.trim()) return markup;
  const root = parseDocument(markup) as unknown as ParsedNode;
  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith("__visual_path:") || !value || typeof value !== "object") continue;
    const path = key.slice("__visual_path:".length).split("-").filter(Boolean).map(Number);
    if (path.some((index) => !Number.isInteger(index) || index < 0)) continue;
    const node = nodeAtPath(root, path);
    if (node) applyOverride(node, value);
  }
  return (root.children ?? []).map(serialize).join("");
}
