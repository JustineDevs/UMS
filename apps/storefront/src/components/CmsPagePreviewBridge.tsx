"use client";

import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { sanitizeSafeUrl } from "@universal-music-store/sdk";
import { z } from "zod";
import { useEffect } from "react";

type DraftBlock = {
  id: string;
  componentId?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  styleOverrides?: Record<string, unknown>;
  slots?: Record<string, DraftBlock[]>;
};

type BuilderMessage = {
  source?: string;
  id?: unknown;
  mode?: unknown;
  blocks?: unknown;
  tree?: unknown;
  prop?: unknown;
  value?: unknown;
};

function getParentOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : window.location.origin;
  } catch {
    return "";
  }
}

function nodeRect(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function draftBlocks(value: unknown): DraftBlock[] {
  const result: DraftBlock[] = [];
  const visit = (item: unknown) => {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.length > 200) return;
    result.push({
      id: item.id,
      componentId: typeof item.componentId === "string" ? item.componentId : undefined,
      props: isRecord(item.props) ? item.props : undefined,
      styles: isRecord(item.styles) ? item.styles : undefined,
      styleOverrides: isRecord(item.styleOverrides) ? item.styleOverrides : undefined,
      slots: isRecord(item.slots) ? {} : undefined,
    });
    if (isRecord(item.slots)) {
      Object.values(item.slots).forEach((children) => {
        if (Array.isArray(children)) children.forEach(visit);
      });
    }
  };
  if (Array.isArray(value)) value.forEach(visit);
  return result;
}

function draftTree(value: unknown): DraftBlock[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of value) {
    if (isRecord(item) && typeof item.id === "string") byId.set(item.id, item);
  }
  const result: DraftBlock[] = [];
  const visit = (id: string) => {
    const item = byId.get(id);
    if (!item) return;
    result.push({
      id,
      componentId: typeof item.componentId === "string" ? item.componentId : undefined,
      props: isRecord(item.props) ? item.props : undefined,
      styles: isRecord(item.styles) ? item.styles : undefined,
      slots: {},
    });
    if (Array.isArray(item.children)) {
      for (const child of item.children) if (typeof child === "string") visit(child);
    }
  };
  for (const item of byId.values()) {
    if (item.parentId === null || item.parentId === undefined) visit(item.id as string);
  }
  return result;
}

function safeText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function indexedValue(value: unknown, index: string | undefined, field?: string) {
  if (!index) return value;
  if (!Array.isArray(value)) return undefined;
  const item = value[Number(index)];
  return isRecord(item) ? item[field ?? "q"] ?? "" : item;
}

function setSafeUrl(node: Element, value: unknown, attribute: "href" | "src" | "action") {
  const safe = sanitizeSafeUrl(value, {
    baseUrl: window.location.origin,
    allowRelative: true,
  });
  if (!safe) return;
  node.setAttribute(attribute, safe);
}

function setSafeStyle(node: HTMLElement, key: string, value: unknown) {
  if (!/^--cms-[a-z0-9-]+$/.test(key) || typeof value !== "string" || value.length > 200) return;
  if (/[{};]/.test(value) || /url\s*\(/i.test(value)) return;
  node.style.setProperty(key, value);
}

const semanticTags = new Set([
  "div",
  "section",
  "article",
  "header",
  "nav",
  "main",
  "aside",
  "footer",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "button",
  "a",
  "ul",
  "ol",
  "li",
]);

function applyAccessibility(node: HTMLElement, value: unknown): HTMLElement {
  if (!isRecord(value)) return node;
  const semanticTag = typeof value.semanticTag === "string" ? value.semanticTag : "";
  if (semanticTags.has(semanticTag) && node.tagName.toLowerCase() !== semanticTag) {
    const replacement = document.createElement(semanticTag);
    for (const attribute of Array.from(node.attributes)) {
      replacement.setAttribute(attribute.name, attribute.value);
    }
    replacement.replaceChildren(...Array.from(node.childNodes));
    node.replaceWith(replacement);
    node = replacement;
  }
  if (semanticTags.has(semanticTag)) node.dataset.cmsSemanticTag = semanticTag;
  for (const [key, attribute] of [
    ["ariaLabel", "aria-label"],
    ["ariaDescription", "aria-description"],
    ["role", "role"],
    ["tabIndex", "tabindex"],
  ] as const) {
    const next = value[key];
    if (next === undefined || next === null || next === "") node.removeAttribute(attribute);
    else node.setAttribute(attribute, String(next).slice(0, 200));
  }
  return node;
}

const editableDomStyles = new Set([
  "display",
  "position",
  "width",
  "height",
  "margin",
  "padding",
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "border-radius",
  "gap",
  "align-items",
  "justify-content",
  "grid-template-columns",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "line-height",
  "letter-spacing",
  "border",
  "box-shadow",
  "object-fit",
  "object-position",
  "background-size",
  "background-position",
]);

const builderMessageSchema = z.object({
  source: z.string().max(64),
  id: z.string().max(200).optional(),
  prop: z.string().max(100).optional(),
  value: z.string().max(100_000).optional(),
  blocks: z.unknown().optional(),
  tree: z.unknown().optional(),
  mode: z.string().max(32).optional(),
});

function applyDomEdit(node: HTMLElement, property: string, value: string) {
  if (property === "textContent" && node.children.length === 0) {
    node.textContent = value;
    return true;
  }
  if (property === "href" && node instanceof HTMLAnchorElement) {
    setSafeUrl(node, value, "href");
    return node.hasAttribute("href");
  }
  if (property === "src" && (node instanceof HTMLImageElement || node instanceof HTMLVideoElement)) {
    setSafeUrl(node, value, "src");
    return node.hasAttribute("src");
  }
  if (property.startsWith("style.") && editableDomStyles.has(property.slice(6))) {
    const cssProperty = property.slice(6);
    if (value.length > 200 || /[{};]/.test(value) || /url\s*\(/i.test(value)) return false;
    node.style.setProperty(cssProperty, value);
    return true;
  }
  return false;
}

function applyDraft(root: HTMLElement, block: DraftBlock) {
  const props = isRecord(block.props) ? block.props : {};
  root = applyAccessibility(root, props.accessibility);
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("[data-cms-prop], [data-cms-url-prop]"))];
  for (const node of nodes) {
    const prop = node.dataset.cmsProp;
    const urlProp = node.dataset.cmsUrlProp;
    const index = node.dataset.cmsArrayIndex;
    if (prop) {
      const value = indexedValue(props[prop], index, node.dataset.cmsArrayField);
      const recordValue = isRecord(value) ? value.q ?? value.a ?? "" : value;
      if (node.dataset.cmsValueKind === "html") {
        node.innerHTML = sanitizeCmsHtml(safeText(recordValue));
      } else if ((prop === "alt" || prop.endsWith("Alt")) && node instanceof HTMLImageElement) {
        node.alt = safeText(recordValue);
      } else if (node.dataset.cmsValueKind === "number") {
        const number = Number(recordValue);
        if (Number.isFinite(number)) {
          node.style.marginTop = `${Math.max(0, Math.min(number, 1000))}px`;
          node.style.marginBottom = `${Math.max(0, Math.min(number, 1000))}px`;
        }
      } else if (recordValue !== undefined && recordValue !== null) {
        node.textContent = safeText(recordValue);
      }
    }
    if (urlProp) {
      const value = props[urlProp];
      if (node instanceof HTMLImageElement || node instanceof HTMLVideoElement || node instanceof HTMLIFrameElement) {
        setSafeUrl(node, value, "src");
      } else if (node instanceof HTMLAnchorElement) {
        setSafeUrl(node, value, "href");
      } else if (node instanceof HTMLFormElement) {
        setSafeUrl(node, value, "action");
      }
    }
  }
  if (isRecord(block.styleOverrides)) {
    for (const [key, value] of Object.entries(block.styleOverrides)) setSafeStyle(root, key, value);
  }
  if (isRecord(block.styles)) {
    for (const [key, value] of Object.entries(block.styles)) setSafeStyle(root, `--cms-${key}`, value);
  }
}

function enableInlineEditing() {
  for (const node of Array.from(
    document.querySelectorAll<HTMLElement>("[data-cms-prop]"),
  )) {
    const kind = node.dataset.cmsValueKind;
    if (kind === "html" || node.matches("p, h1, h2, h3, h4, h5, h6, span, figcaption, a")) {
      node.contentEditable = "true";
      node.dataset.cmsInlineEditable = "true";
      node.spellcheck = true;
    }
  }
}

function decorateEditorNodes() {
  const nodes = Array.from(
    document.body.querySelectorAll<HTMLElement>(
      "*:not(script):not(style):not(noscript)",
    ),
  );
  nodes.forEach((node) => {
    if (!node.dataset.cmsId) {
      const path: number[] = [];
      let current: Element | null = node;
      while (current && current !== document.body) {
        path.unshift(
          Array.prototype.indexOf.call(
            current.parentElement?.children ?? [],
            current,
          ),
        );
        current = current.parentElement;
      }
      node.dataset.cmsId = `cms-dom-${path.join("-")}`;
      node.dataset.cmsGenerated = "true";
      node.dataset.cmsLabel =
        node.getAttribute("aria-label") ||
        node.getAttribute("name") ||
        node.tagName.toLowerCase();
    }
    const owner = node.closest<HTMLElement>(
      "[data-cms-id]:not([data-cms-generated='true'])",
    );
    if (owner?.dataset.cmsBlockId) {
      node.dataset.cmsBlockId = owner.dataset.cmsBlockId;
    }
  });
}

export function CmsPagePreviewBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    // Homepage preview has a richer bridge that owns its CMS payload mapping.
    if (new URLSearchParams(window.location.search).get("adminPreview") === "1") {
      return;
    }
    const origin = getParentOrigin();
    if (!origin) return;

    decorateEditorNodes();
    const observer = new MutationObserver(decorateEditorNodes);
    observer.observe(document.body, { childList: true, subtree: true });

    const allNodes = () => Array.from(document.querySelectorAll<HTMLElement>("[data-cms-id]"));
    const findNode = (id: string) => allNodes().find((node) => node.dataset.cmsId === id) ?? null;
    let selectedNode: HTMLElement | null = null;
    const markSelected = (node: HTMLElement | null) => {
      selectedNode = node;
      for (const item of allNodes()) item.dataset.selected = item === node ? "true" : "false";
    };
    const send = (source: string, node: HTMLElement | null) => {
      window.parent.postMessage(
        {
          source,
          id: node?.dataset.cmsId ?? null,
          label: node?.dataset.cmsLabel ?? node?.dataset.cmsBlockType ?? null,
          blockId: node?.dataset.cmsBlockId ?? null,
          parentId:
            node?.parentElement?.closest<HTMLElement>(
              "[data-cms-id]:not([data-cms-generated='true'])",
            )?.dataset.cmsId ?? null,
          tagName: node?.tagName.toLowerCase(),
          text:
            node && node.children.length === 0
              ? (node.textContent ?? "").slice(0, 2000)
              : "",
          href: node?.closest<HTMLAnchorElement>("a[href]")?.href ?? "",
          src:
            node instanceof HTMLImageElement || node instanceof HTMLVideoElement
              ? node.currentSrc || node.src
              : node?.closest<HTMLImageElement>("img[src]")?.currentSrc ?? "",
          style: node
            ? [
                "display",
                "position",
                "width",
                "height",
                "margin",
                "padding",
                "color",
                "background-color",
                "font-size",
                "font-weight",
                "border-radius",
                "gap",
                "align-items",
                "justify-content",
                "grid-template-columns",
                "min-width",
                "max-width",
                "min-height",
                "max-height",
                "line-height",
                "letter-spacing",
                "border",
                "box-shadow",
                "object-fit",
                "object-position",
                "background-size",
                "background-position",
              ].reduce<Record<string, string>>((result, property) => {
                const value = node.style.getPropertyValue(property);
                if (value) result[property] = value;
                return result;
              }, {})
            : {},
          rect: node ? nodeRect(node) : null,
        },
        origin,
      );
    };
    const selected = () => allNodes().find((node) => node.dataset.selected === "true") ?? null;
    const reportSelected = () => send("cms-builder", selected());
    const onClick = (event: MouseEvent) => {
      const node = (event.target as Element | null)?.closest<HTMLElement>("[data-cms-id]");
      if (!node) return;
      event.preventDefault();
      markSelected(node);
      send("cms-builder", node);
    };
    const onMessage = (event: MessageEvent<BuilderMessage>) => {
      if (event.source !== window.parent || event.origin !== origin) return;
      const message = builderMessageSchema.safeParse(event.data);
      if (!message.success) return;
      if (message.data.source === "cms-builder-select") {
        const id = message.data.id ?? "";
        const node = id ? findNode(id) : null;
        markSelected(node);
        if (node) node.scrollIntoView({ block: "nearest" });
        send("cms-builder", node);
        return;
      }
      if (message.data.source === "cms-builder-dom-edit") {
        const id = message.data.id ?? "";
        const property = message.data.prop ?? "";
        const value = message.data.value ?? "";
        if (!selectedNode || selectedNode.dataset.cmsId !== id || !property || value.length > 100_000) return;
        if (!applyDomEdit(selectedNode, property, value)) return;
        window.parent.postMessage(
          {
            source: "cms-builder-dom-mutation",
            id,
            blockId: selectedNode.dataset.cmsBlockId ?? null,
            prop: property,
            value,
          },
          origin,
        );
        send("cms-builder", selectedNode);
        return;
      }
      if (message.data.source !== "cms-builder-draft") return;
      const draft = message.data.tree
        ? draftTree(message.data.tree)
        : draftBlocks(message.data.blocks);
      for (const block of draft) {
        const root = findNode(block.id);
        if (root) applyDraft(root, block);
      }
      enableInlineEditing();
    };
    const onInput = (event: Event) => {
      const node = (event.target as Element | null)?.closest<HTMLElement>(
        "[data-cms-inline-editable][data-cms-id][data-cms-prop]",
      );
      if (!node) return;
      event.stopPropagation();
      window.parent.postMessage(
        {
          source: "cms-builder-mutation",
          id: node.dataset.cmsId,
          prop: node.dataset.cmsProp,
          value: node.dataset.cmsValueKind === "html" ? node.innerHTML : node.textContent ?? "",
        },
        origin,
      );
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    window.addEventListener("message", onMessage);
    window.addEventListener("scroll", reportSelected, { passive: true });
    window.addEventListener("resize", reportSelected);
    window.parent.postMessage({ source: "cms-preview-ready" }, origin);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("scroll", reportSelected);
      window.removeEventListener("resize", reportSelected);
      observer.disconnect();
      selectedNode = null;
    };
  }, []);

  return null;
}
