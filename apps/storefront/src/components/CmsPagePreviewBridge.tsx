"use client";

import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { sanitizeSafeUrl } from "@universal-music-store/sdk";
import { useEffect } from "react";

type DraftBlock = {
  id: string;
  props?: Record<string, unknown>;
  styleOverrides?: Record<string, unknown>;
};

type BuilderMessage = {
  source?: string;
  id?: unknown;
  mode?: unknown;
  blocks?: unknown;
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
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DraftBlock => {
    return isRecord(item) && typeof item.id === "string" && item.id.length <= 200;
  });
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
]);

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
      if (event.source !== window.parent || event.origin !== origin || !isRecord(event.data)) return;
      if (event.data.source === "cms-builder-select") {
        const id = typeof event.data.id === "string" ? event.data.id : "";
        const node = id ? findNode(id) : null;
        markSelected(node);
        if (node) node.scrollIntoView({ block: "nearest" });
        send("cms-builder", node);
        return;
      }
      if (event.data.source === "cms-builder-dom-edit") {
        const id = typeof event.data.id === "string" ? event.data.id : "";
        const property = typeof event.data.prop === "string" ? event.data.prop : "";
        const value = typeof event.data.value === "string" ? event.data.value : "";
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
      if (event.data.source !== "cms-builder-draft") return;
      for (const block of draftBlocks(event.data.blocks)) {
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
