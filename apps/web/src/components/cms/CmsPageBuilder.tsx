"use client";

import type {
  CmsBlock,
  CmsComponentDefinition,
  CmsComponentInstance,
  CmsPageBlockPresetRow,
} from "@universal-music-store/platform-data";
import {
  getCmsComponentDefinition,
  canonicalCmsBlockDefinition,
  componentInstanceFromBlock,
  cmsBlocksToTree,
  getCmsDefaultProps,
  listCmsComponentDefinitions,
  listCmsBlockPalette,
  resolveCmsComponentDefinition,
} from "@universal-music-store/platform-data";
import {
  cmsComponentDefinitionSchema,
  cmsComponentCanvasMutationSchema,
  cmsPreviewMessageSchema,
} from "@/lib/cms-component-contract";
import { cmsMutationHeaders } from "@/lib/cms-mutation-headers";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { PickedMedia } from "@/components/catalog/CatalogMediaPickerDialog";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Box,
  Eye,
  FileText,
  History,
  Layers,
  Laptop,
  Maximize2,
  Menu,
  Mic,
  Minus,
  Monitor,
  Paintbrush,
  Paperclip,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Settings2,
  Sparkles,
  SunMoon,
  Tablet,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  MousePointer2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, DragEvent, ReactNode } from "react";
import {
  createCmsHistory,
  applyCmsMutation,
  recordCmsCommand,
  redoCmsCommand,
  undoCmsCommand,
  moveCmsInstance,
  type CmsHistory,
  type CmsMutation,
} from "@/lib/cms-tree-commands";
import type { StyleTheme } from "@/lib/visual-builder/style-manager";
import type {
  ColorPalette,
  PaletteVariableType,
} from "@/lib/visual-builder/color-palette";
import { UvsCmsClient } from "@/lib/visual-builder/cms-rest-client";
import {
  UVS_DEFINITIONS,
  type VisualComponentDefinition,
} from "@/lib/visual-builder/component-definitions";
import { readResponseJson } from "@/lib/read-response-json";
import {
  cmsPreviewSandbox,
  cmsPreviewTargetOrigin,
  isCmsPreviewMessageFromFrame,
} from "@/lib/cms-preview-frame";
import { mapCmsPreviewRectToCanvas } from "./cms-preview-geometry";

const BLOCK_TYPES = listCmsBlockPalette().map((item) => ({
  ...item,
  group: componentPaletteGroup(item.group),
}));

const FIXED_COMPONENT_TYPES = new Set([
  "storefront_header",
  "header_navigation",
  "header_actions",
  "storefront_footer",
  "footer_columns",
]);

function componentPaletteGroup(category: string) {
  switch (category.toLowerCase()) {
    case "global":
      return "Server Components";
    case "sections":
      return "Bootstrap 5";
    case "commerce":
      return "Ecommerce";
    case "content":
      return "Content";
    default:
      return "Base";
  }
}

function sourcePaletteGroup(type: string) {
  if (type === "_base" || type.startsWith("html/")) return "Base";
  if (type.startsWith("config/")) return "Bootstrap 5";
  if (type.startsWith("elements/")) return "Elements";
  if (type.startsWith("embeds/")) return "Embeds";
  if (type.startsWith("ecommerce/")) return "Ecommerce";
  if (type.startsWith("components/")) return "Server Components";
  if (type.startsWith("widgets/")) return "Widgets";
  return "Base";
}

// Keep the palette in the same registration order as the vendored Vvveb editor.
// Unknown/custom groups stay after the source groups and remain alphabetic.
const VVVEB_PALETTE_GROUP_ORDER = [
  "Base",
  "Bootstrap 5",
  "Elements",
  "Embeds",
  "Widgets",
  "Server Components",
  "Content",
  "Ecommerce",
];

function comparePaletteGroups(
  [left]: [string, unknown],
  [right]: [string, unknown],
) {
  const leftRank = VVVEB_PALETTE_GROUP_ORDER.indexOf(left);
  const rightRank = VVVEB_PALETTE_GROUP_ORDER.indexOf(right);
  return (
    (leftRank === -1 ? VVVEB_PALETTE_GROUP_ORDER.length : leftRank) -
      (rightRank === -1 ? VVVEB_PALETTE_GROUP_ORDER.length : rightRank) ||
    left.localeCompare(right)
  );
}

function visualIconPath(definition: VisualComponentDefinition) {
  const icon =
    definition.image?.replace(/^icons\//, "") ??
    definition.markup.match(/icons\/([^"'\s]+)/i)?.[1] ??
    (definition.type.includes("image")
      ? "image.svg"
      : definition.type.includes("video")
        ? "video.svg"
        : "icon.svg");
  return `/vvveb-icons/${icon}`;
}

function visualDefinitionForBlock(block: CmsBlock | null | undefined) {
  const type = block?.componentId?.startsWith("visual:")
    ? block.componentId.slice("visual:".length)
    : undefined;
  return type
    ? UVS_DEFINITIONS.find((definition) => definition.type === type)
    : undefined;
}

function visualMarkupTarget(
  root: Element,
  property: VisualComponentDefinition["properties"][number],
) {
  return property.child ? (root.querySelector(property.child) ?? root) : root;
}

function replaceWithSanitizedHtml(
  target: Element,
  html: string,
  ownerDocument: Document,
) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  target.replaceChildren(
    ...Array.from(parsed.body.childNodes, (node) =>
      ownerDocument.importNode(node, true),
    ),
  );
}

/** Keep the live canvas subject to the same HTML policy as published CMS output. */
export function sanitizeVisualPropertyValue(
  property: VisualComponentDefinition["properties"][number],
  value: string,
): string {
  if (property.htmlAttr === "innerHTML" || property.key === "innerHTML") {
    return sanitizeCmsHtml(value);
  }
  const attribute = property.htmlAttr ?? property.key;
  if (property.inputtype !== "url" && attribute !== "href" && attribute !== "src") {
    return value;
  }
  const trimmed = value.trim();
  if (
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    trimmed.startsWith("//") ||
    /^(?:javascript|vbscript|data):/i.test(trimmed)
  ) {
    return "";
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^(?:https?|mailto|tel):/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function visualMarkupWithProperty(
  markup: string,
  definition: VisualComponentDefinition,
  key: string,
  value: string,
) {
  if (typeof DOMParser === "undefined") return markup;
  const document = new DOMParser().parseFromString(
    `<body>${markup}</body>`,
    "text/html",
  );
  const root = document.body.firstElementChild;
  const property = definition.properties.find((item) => item.key === key);
  if (!root || !property) return markup;
  const safeValue = sanitizeVisualPropertyValue(property, value);
  if (
    !property.child &&
    definition.lifecycle?.onChange(root as HTMLElement, key, safeValue)
  ) {
    return document.body.innerHTML;
  }
  if (key === "size" && /^H[1-6]$/i.test(root.tagName)) {
    const replacement = document.createElement(`h${value}`);
    replacement.innerHTML = root.innerHTML;
    for (const attribute of Array.from(root.attributes))
      replacement.setAttribute(attribute.name, attribute.value);
    root.replaceWith(replacement);
  } else {
    const target = visualMarkupTarget(root, property);
    const attribute = property.htmlAttr ?? property.key;
    if (attribute === "innerHTML")
      replaceWithSanitizedHtml(target, safeValue, document);
    else if (attribute === "nodeName") {
      const replacement = document.createElement(value.toLowerCase());
      replacement.innerHTML = target.innerHTML;
      for (const item of Array.from(target.attributes))
        replacement.setAttribute(item.name, item.value);
      target.replaceWith(replacement);
    } else if (property.inputtype === "checkbox") {
      if (value === "true") target.setAttribute(attribute, "");
      else target.removeAttribute(attribute);
    } else target.setAttribute(attribute, value);
  }
  return document.body.innerHTML;
}

function visualInitialProps(definition: VisualComponentDefinition) {
  const props: Record<string, unknown> = {};
  if (typeof DOMParser === "undefined") return props;
  const document = new DOMParser().parseFromString(
    `<body>${definition.markup}</body>`,
    "text/html",
  );
  const root = document.body.firstElementChild;
  if (!root) return props;
  for (const property of definition.properties) {
    const target = visualMarkupTarget(root, property);
    const attribute = property.htmlAttr ?? property.key;
    if (attribute === "innerHTML") props[property.key] = target.innerHTML;
    else if (attribute === "nodeName")
      props[property.key] = root.tagName.slice(1);
    else if (property.inputtype === "checkbox")
      props[property.key] = target.hasAttribute(attribute);
    else
      props[property.key] =
        target.getAttribute(attribute) ?? property.options?.[0]?.value ?? "";
  }
  return props;
}

type BuilderPage = { id: string; title: string; slug: string; status: string };
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult:
    | ((_event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((_event?: unknown) => void) | null;
  onend: (() => void) | null;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type CmsRevisionRow = {
  id: string;
  revision: number;
  sequence: number;
  mutation: CmsMutation;
  created_at: string;
};
type PreviewTarget = {
  id: string;
  blockId?: string | null;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  tagName?: string;
  text?: string;
  href?: string;
  src?: string;
  style?: Record<string, string>;
  parentId?: string | null;
  propertyKey?: string | null;
  arrayIndex?: number | null;
};
type ComponentNode = {
  id: string;
  label: string;
  blockId: string;
  depth: number;
  fixed?: boolean;
  propertyKey?: string;
  arrayIndex?: number;
  children?: ComponentNode[];
};
type CmsMutationShape =
  | {
      type: "insert" | "remove" | "move";
      nodeId?: string;
      parentId?: string | null;
      beforeParentId?: string | null;
      index?: number;
      slot?: string;
      node?: CmsBlock | CmsComponentInstance;
    }
  | {
      type: "set-prop" | "set-style";
      nodeId: string;
      key: string;
      before?: unknown;
      after?: unknown;
    }
  | {
      type: "set-attribute" | "set-text" | "set-html";
      nodeId: string;
      key?: string;
      before?: unknown;
      after?: unknown;
    };
const LABELS: Record<string, string> = Object.fromEntries(
  BLOCK_TYPES.map((b) => [b.type, b.label]),
);
LABELS.unknown_component = "Unknown component";

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `block_${Date.now()}`;
}

function VvvebIcon({
  name,
  className = "size-4",
}: {
  name:
    | "file-manager-layout"
    | "left-column-layout"
    | "right-column-layout"
    | "folder"
    | "icon-list"
    | "file";
  className?: string;
}) {
  return (
    <Image
      src={`/vvveb-icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      className={className}
      width={16}
      height={16}
    />
  );
}

function mutationForBlocks(
  before: CmsBlock[],
  after: CmsBlock[],
): CmsMutationShape {
  const beforeIds = before.map((block) => block.id);
  const afterIds = after.map((block) => block.id);
  const beforeIdSet = new Set(beforeIds);
  const afterIdSet = new Set(afterIds);
  if (
    after.length === before.length &&
    beforeIds.join("|") !== afterIds.join("|")
  ) {
    const moved = afterIds.find((id, index) => beforeIds[index] !== id);
    return {
      type: "move",
      nodeId: moved,
      parentId: null,
      beforeParentId: null,
      index: moved ? afterIds.indexOf(moved) : undefined,
      node: after.find((block) => block.id === moved),
    };
  }
  if (after.length === before.length + 1) {
    const node = after.find((block) => !beforeIdSet.has(block.id));
    return {
      type: "insert",
      nodeId: node?.id,
      parentId: null,
      index: node ? afterIds.indexOf(node.id) : undefined,
      node,
    };
  }
  if (after.length + 1 === before.length) {
    const node = before.find((block) => !afterIdSet.has(block.id));
    return {
      type: "remove",
      nodeId: node?.id,
      parentId: null,
      index: node ? beforeIds.indexOf(node.id) : undefined,
      node,
    };
  }
  const beforeNodes = flattenCmsNodes(before);
  const afterNodes = flattenCmsNodes(after);
  const changed = afterNodes.find((node) => {
    const old = beforeNodes.find((candidate) => candidate.id === node.id);
    return old && JSON.stringify(old.props) !== JSON.stringify(node.props);
  });
  if (changed) {
    const old = beforeNodes.find((node) => node.id === changed.id)!;
    return {
      type: "set-prop",
      nodeId: changed.id,
      key: "__props",
      before: old.props,
      after: changed.props,
    };
  }
  const styled = afterNodes.find((node) => {
    const old = beforeNodes.find((candidate) => candidate.id === node.id);
    return old && JSON.stringify(old.styles) !== JSON.stringify(node.styles);
  });
  if (styled) {
    const old = beforeNodes.find((node) => node.id === styled.id)!;
    return {
      type: "set-style",
      nodeId: styled.id,
      key: "__styles",
      before: old.styles,
      after: styled.styles,
    };
  }
  return {
    type: "set-prop",
    nodeId: after[0]?.id ?? before[0]?.id ?? "",
    key: "__noop",
    before: null,
    after: null,
  };
}

function flattenCmsNodes(blocks: CmsBlock[]) {
  const nodes: Array<{
    id: string;
    props: Record<string, unknown>;
    styles: Record<string, string>;
  }> = [];
  const visit = (instance: CmsComponentInstance) => {
    nodes.push({
      id: instance.id,
      props: instance.props,
      styles: instance.styleOverrides ?? {},
    });
    Object.values(instance.slots ?? {})
      .flat()
      .forEach(visit);
  };
  blocks.forEach((block) => {
    nodes.push({
      id: block.id,
      props: block.props,
      styles: block.styleOverrides ?? {},
    });
    Object.values(block.slots ?? {})
      .flat()
      .forEach(visit);
  });
  return nodes;
}

function findCmsNode(
  blocks: CmsBlock[],
  nodeId: string,
): CmsBlock | CmsComponentInstance | undefined {
  for (const block of blocks) {
    if (block.id === nodeId) return block;
    const visit = (
      items: CmsComponentInstance[],
    ): CmsComponentInstance | undefined => {
      for (const item of items) {
        if (item.id === nodeId) return item;
        const nested = visit(Object.values(item.slots ?? {}).flat());
        if (nested) return nested;
      }
      return undefined;
    };
    const found = visit(Object.values(block.slots ?? {}).flat());
    if (found) return found;
  }
  return undefined;
}

function cmsMutationValue(
  blocks: CmsBlock[],
  mutation: CmsMutationShape,
  direction: "before" | "after",
) {
  if (mutation.type !== "set-prop" && mutation.type !== "set-style")
    return undefined;
  if (direction === "before" && mutation.before !== undefined)
    return mutation.before;
  if (direction === "after" && mutation.after !== undefined)
    return mutation.after;
  const node = findCmsNode(blocks, mutation.nodeId);
  if (!node) return undefined;
  if (mutation.type === "set-prop")
    return mutation.key === "__props" ? node.props : node.props[mutation.key];
  return mutation.key === "__styles"
    ? "type" in node
      ? (node.styleOverrides ?? {})
      : (node.styleOverrides ?? {})
    : "type" in node
      ? node.styleOverrides?.[mutation.key]
      : node.styleOverrides?.[mutation.key];
}

function persistedCmsMutation(
  before: CmsBlock[],
  after: CmsBlock[],
  mutation?: CmsMutationShape,
): CmsMutationShape | undefined {
  const next = mutation ?? mutationForBlocks(before, after);
  if (!next) return undefined;
  if (next.type === "set-prop" || next.type === "set-style") {
    return {
      ...next,
      before: next.before ?? cmsMutationValue(before, next, "after"),
      after: next.after ?? cmsMutationValue(after, next, "after"),
    };
  }
  const structural = next as Extract<
    CmsMutationShape,
    { type: "insert" | "remove" | "move" }
  >;
  if (structural.node || !structural.nodeId) return structural;
  return { ...structural, node: findCmsNode(before, structural.nodeId) };
}

function normalize(raw: unknown): CmsBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    const row =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const requestedType = typeof row.type === "string" ? row.type : "";
    const type = requestedType || "unknown_component";
    const props =
      row.props && typeof row.props === "object"
        ? (row.props as Record<string, unknown>)
        : getCmsDefaultProps(type);
    return {
      ...row,
      id: typeof row.id === "string" && row.id ? row.id : makeId(),
      type,
      componentId:
        typeof row.componentId === "string" ? row.componentId : undefined,
      variantId: typeof row.variantId === "string" ? row.variantId : undefined,
      slots:
        row.slots && typeof row.slots === "object" && !Array.isArray(row.slots)
          ? (row.slots as CmsBlock["slots"])
          : undefined,
      styleOverrides:
        row.styleOverrides &&
        typeof row.styleOverrides === "object" &&
        !Array.isArray(row.styleOverrides)
          ? (row.styleOverrides as Record<string, string>)
          : undefined,
      props:
        type === "unknown_component"
          ? {
              ...props,
              originalType: requestedType || "unknown",
              originalNode: row,
            }
          : props,
    } as CmsBlock;
  });
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback);
}
function escapeHtml(value: unknown) {
  return text(value).replace(
    /[&<>\"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function resolvedComponentProps(
  definition: CmsComponentDefinition | undefined,
  variantId: string | undefined,
  props: Record<string, unknown>,
) {
  const defaults = Object.fromEntries(
    (definition?.props ?? [])
      .filter((item) => item.defaultValue !== undefined)
      .map((item) => [item.key, item.defaultValue]),
  );
  const variant = definition?.variants.find(
    (item) => item.id === (variantId ?? definition.defaultVariantId),
  );
  return { ...defaults, ...(variant?.props ?? {}), ...props };
}

function instanceOverrides(
  definition: CmsComponentDefinition | undefined,
  variantId: string | undefined,
  props: Record<string, unknown>,
) {
  const inherited = resolvedComponentProps(definition, variantId, {});
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(inherited[key]),
    ),
  );
}

function componentChildId(block: CmsBlock, key: string) {
  if (block.type === "storefront_header") {
    if (key === "navigation") return "header-navigation";
    if (key === "brand") return "header-brand";
    if (key === "actions") return "header-actions";
  }
  if (block.type === "header_navigation" && key === "brand")
    return "header-brand";
  if (block.type === "header_actions" && key === "self")
    return "header-actions";
  if (block.type === "storefront_footer") {
    if (key === "columns") return "footer-columns";
    if (key === "brand") return "footer-brand";
    if (key === "shopLinks") return "footer-shop-links";
    if (key === "supportLinks") return "footer-support-links";
    if (key === "socialLinks") return "footer-social-links";
  }
  if (block.id === "home-tiles" && key.startsWith("tile-")) {
    return `home-tile-${key.slice("tile-".length)}`;
  }
  if (block.id.startsWith("home-")) return `${block.id}-${key}`;
  return `${block.id}::${key}`;
}

function applyPreviewMutation(
  blocks: CmsBlock[],
  nodeId: string,
  property: string,
  value: string,
) {
  const instanceId = nodeId.split("::", 1)[0];
  let changed = false;
  const updateInstances = (
    instances: CmsComponentInstance[] | undefined,
  ): CmsComponentInstance[] | undefined => {
    if (!instances) return instances;
    return instances.map((instance) => {
      let next = instance;
      if (instance.id === instanceId) {
        next = { ...next, props: { ...next.props, [property]: value } };
        changed = true;
      }
      const slots = Object.fromEntries(
        Object.entries(next.slots ?? {}).map(([slot, children]) => [
          slot,
          updateInstances(children) ?? [],
        ]),
      );
      return { ...next, slots };
    });
  };
  const nextBlocks = blocks.map((block) => {
    if (block.id === instanceId) {
      changed = true;
      return { ...block, props: { ...block.props, [property]: value } };
    }
    const slots = Object.fromEntries(
      Object.entries(block.slots ?? {}).map(([slot, children]) => [
        slot,
        updateInstances(children) ?? [],
      ]),
    );
    return { ...block, slots };
  });
  return changed ? nextBlocks : blocks;
}

function applyDomMutation(
  blocks: CmsBlock[],
  blockId: string,
  nodeId: string,
  property: string,
  value: string,
  visualPath?: string,
) {
  if (!blockId || !blocks.some((block) => block.id === blockId)) return blocks;
  return blocks.map((block) => {
    if (block.id !== blockId) return block;
    const domOverrides =
      block.props.domOverrides && typeof block.props.domOverrides === "object"
        ? (block.props.domOverrides as Record<string, Record<string, string>>)
        : {};
    const overrideId = visualPath ? `__visual_path:${visualPath}` : nodeId;
    return {
      ...block,
      props: {
        ...block.props,
        domOverrides: {
          ...domOverrides,
          [overrideId]: {
            ...(domOverrides[overrideId] ?? {}),
            [property]: value,
          },
        },
      },
    };
  });
}

function componentInstanceNodes(
  block: CmsBlock,
  instances: CmsComponentInstance[] | undefined,
  depth: number,
): ComponentNode[] {
  return (instances ?? []).flatMap((instance) => {
    const definition = listCmsComponentDefinitions().find(
      (item) => item.id === instance.componentId,
    );
    return [
      {
        id: instance.id,
        label: definition?.name ?? instance.componentId,
        blockId: block.id,
        depth,
        fixed: false,
        children: Object.entries(instance.slots ?? {}).flatMap(
          ([slot, children]) => [
            {
              id: `${instance.id}::slot::${slot}`,
              label: slot,
              blockId: block.id,
              depth: depth + 1,
              fixed: true,
              children: componentInstanceNodes(block, children, depth + 2),
            },
          ],
        ),
      },
    ];
  });
}

function findComponentInstance(
  instances: CmsComponentInstance[] | undefined,
  id: string,
): CmsComponentInstance | null {
  for (const instance of instances ?? []) {
    if (instance.id === id) return instance;
    const nested = Object.values(instance.slots ?? []).flatMap(
      (items) => items,
    );
    const match = findComponentInstance(nested, id);
    if (match) return match;
  }
  return null;
}

function updateComponentInstances(
  instances: CmsComponentInstance[] | undefined,
  id: string,
  update: (_instance: CmsComponentInstance) => CmsComponentInstance,
): CmsComponentInstance[] | undefined {
  if (!instances) return instances;
  return instances.map((instance) => {
    if (instance.id === id) return update(instance);
    const slots = Object.fromEntries(
      Object.entries(instance.slots ?? {}).map(([slot, children]) => [
        slot,
        updateComponentInstances(children, id, update) ?? [],
      ]),
    );
    return { ...instance, slots };
  });
}

function removeInstanceFromSlots(
  slots: Record<string, CmsComponentInstance[]>,
  id: string,
): {
  slots: Record<string, CmsComponentInstance[]>;
  removed: CmsComponentInstance | null;
} {
  let removed: CmsComponentInstance | null = null;
  const next = Object.fromEntries(
    Object.entries(slots).map(([slot, items]) => {
      if (removed) return [slot, items];
      const directIndex = items.findIndex((item) => item.id === id);
      if (directIndex >= 0) {
        removed = items[directIndex];
        return [slot, items.filter((_, index) => index !== directIndex)];
      }
      const children = items.map((item) => {
        if (removed) return item;
        const result = removeInstanceFromSlots(item.slots ?? {}, id);
        if (result.removed) removed = result.removed;
        return result.removed ? { ...item, slots: result.slots } : item;
      });
      return [slot, children];
    }),
  ) as Record<string, CmsComponentInstance[]>;
  return { slots: next, removed };
}

function insertInstanceIntoSlots(
  slots: Record<string, CmsComponentInstance[]>,
  ownerId: string,
  slotName: string,
  child: CmsComponentInstance,
  index: number,
): { slots: Record<string, CmsComponentInstance[]>; inserted: boolean } {
  let inserted = false;
  const next = Object.fromEntries(
    Object.entries(slots).map(([slot, items]) => {
      const children = items.map((item) => {
        if (inserted) return item;
        if (item.id === ownerId) {
          const target = [...(item.slots?.[slotName] ?? [])];
          target.splice(Math.max(0, Math.min(index, target.length)), 0, child);
          inserted = true;
          return { ...item, slots: { ...item.slots, [slotName]: target } };
        }
        const result = insertInstanceIntoSlots(
          item.slots ?? {},
          ownerId,
          slotName,
          child,
          index,
        );
        if (result.inserted) inserted = true;
        return result.inserted ? { ...item, slots: result.slots } : item;
      });
      return [slot, children];
    }),
  ) as Record<string, CmsComponentInstance[]>;
  return { slots: next, inserted };
}

function _moveInstanceBetweenSlots(
  blocks: CmsBlock[],
  sourceBlockId: string,
  instanceId: string,
  targetOwnerId: string,
  targetSlot: string,
  targetIndex: number,
): CmsBlock[] {
  const sourceBlock = blocks.find((block) => block.id === sourceBlockId);
  if (!sourceBlock) return blocks;
  const removed = removeInstanceFromSlots(sourceBlock.slots ?? {}, instanceId);
  if (!removed.removed) return blocks;
  let inserted = false;
  const nextBlocks = blocks.map((block) => {
    if (block.id === sourceBlockId) {
      const sourceSlots = removed.slots;
      if (targetOwnerId === sourceBlockId) {
        const target = [...(sourceSlots[targetSlot] ?? [])];
        target.splice(
          Math.max(0, Math.min(targetIndex, target.length)),
          0,
          removed.removed!,
        );
        inserted = true;
        return { ...block, slots: { ...sourceSlots, [targetSlot]: target } };
      }
      const result = insertInstanceIntoSlots(
        sourceSlots,
        targetOwnerId,
        targetSlot,
        removed.removed!,
        targetIndex,
      );
      if (result.inserted) {
        inserted = true;
        return { ...block, slots: result.slots };
      }
      return block;
    }
    if (targetOwnerId !== block.id) {
      const target = insertInstanceIntoSlots(
        block.slots ?? {},
        targetOwnerId,
        targetSlot,
        removed.removed!,
        targetIndex,
      );
      if (target.inserted) {
        inserted = true;
        return { ...block, slots: target.slots };
      }
      return block;
    }
    const target = [...(block.slots?.[targetSlot] ?? [])];
    target.splice(
      Math.max(0, Math.min(targetIndex, target.length)),
      0,
      removed.removed!,
    );
    inserted = true;
    return { ...block, slots: { ...block.slots, [targetSlot]: target } };
  });
  return inserted ? nextBlocks : blocks;
}

export function createComponentCanvasPreviewBlock(
  definition: CmsComponentDefinition,
  variantId: string,
): CmsBlock {
  return {
    id: `canvas-${definition.id}-${variantId}`,
    type: definition.id.replaceAll("-", "_"),
    componentId: definition.id,
    variantId,
    props: resolvedComponentProps(definition, variantId, {}),
    slots: Object.fromEntries(definition.slots.map((slot) => [slot.name, []])),
  };
}

export function componentCanvasDocument(
  block: CmsBlock,
  suppliedDefinition?: CmsComponentDefinition,
) {
  const definition =
    suppliedDefinition ??
    getCmsComponentDefinition(block.componentId ?? block.type);
  const props = resolvedComponentProps(
    definition,
    block.variantId,
    block.props ?? {},
  );
  const escape = (value: unknown) => escapeHtml(String(value ?? ""));
  const generatedFields = (definition?.props ?? [])
    .filter(
      (item) =>
        item.type === "text" ||
        item.type === "rich-text" ||
        item.type === "url",
    )
    .slice(0, 8)
    .map((item) => {
      const value = escape(props[item.key]);
      const content = `<p data-cms-prop="${escape(item.key)}" contenteditable="true">${value}</p>`;
      return `<div><small>${escape(item.label)}</small>${item.type === "url" ? `<a data-cms-prop="${escape(item.key)}" href="${value}" contenteditable="true">${value}</a>` : content}</div>`;
    })
    .join("");
  const markup = definition?.markup?.trim()
    ? sanitizeCmsHtml(definition.markup)
    : `<section data-cms-node="${escape(block.id)}">${generatedFields || `<h2 data-cms-prop="name" contenteditable="true">${escape(definition?.name ?? block.type)}</h2>`}</section>`;
  const styles = String(definition?.styles ?? "")
    .replace(/<\/style/gi, "")
    .replace(/@import[^;]+;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none");
  const serializeScriptData = (value: unknown) =>
    JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  const serializedBlockId = serializeScriptData(block.id);
  const serializedProps = serializeScriptData(props);
  const serializedSlots = serializeScriptData(definition?.slots ?? []);
  const rootMarkup = markup.includes("data-cms-node")
    ? markup
    : `<div data-cms-node="${escape(block.id)}">${markup}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font:14px/1.5 system-ui;color:#172033;background:#f8fafc}[data-cms-node]{min-height:32px;outline:1px solid #d9e0ea;outline-offset:3px}[data-cms-slot]{margin-top:16px;padding:18px;border:2px dashed #93c5fd;border-radius:8px;display:grid;gap:4px;color:#475569}${styles}</style></head><body>${rootMarkup}<script>const blockId=${serializedBlockId};const props=${serializedProps};const slots=${serializedSlots};const targetOrigin=()=>{try{return document.referrer?new URL(document.referrer).origin:location.origin}catch{return location.origin}};const emit=(payload)=>parent.postMessage({source:'cms-component-canvas-mutation',id:blockId,...payload},targetOrigin());document.querySelectorAll('[data-cms-prop]').forEach((node)=>{const key=node.dataset.cmsProp;if(props[key]!==undefined&&node.innerHTML!==props[key]&&node.children.length===0)node.textContent=String(props[key]);if(node.matches('[contenteditable=true]'))node.addEventListener('input',()=>emit({property:key,value:node.innerHTML}));});const root=document.querySelector('[data-cms-node]');slots.forEach((slot)=>{if(!root.querySelector('[data-cms-slot="'+CSS.escape(slot.name)+'"]')){const drop=document.createElement('div');drop.dataset.cmsSlot=slot.name;drop.dataset.cmsNode=blockId+'::slot::'+slot.name;drop.tabIndex=0;const label=document.createElement('strong');label.textContent=String(slot.label||slot.name);const hint=document.createElement('span');hint.textContent='Drop a component here';drop.append(label,hint);drop.addEventListener('dragover',(event)=>{event.preventDefault();drop.dataset.dragover='true'});drop.addEventListener('dragleave',()=>delete drop.dataset.dragover);drop.addEventListener('drop',(event)=>{event.preventDefault();delete drop.dataset.dragover;const componentId=event.dataTransfer&&event.dataTransfer.getData('application/x-cms-component-id');if(componentId)emit({event:'slot-drop',slot:slot.name,componentId})});root.append(drop);}});emit({event:'ready'});</script></body></html>`;
}
const LAYOUT_FIELDS = [
  ["maxWidth", "Max width"],
  ["minHeight", "Min height"],
  ["paddingBlock", "Vertical padding"],
  ["paddingInline", "Horizontal padding"],
  ["marginBlock", "Vertical margin"],
  ["marginInline", "Horizontal margin"],
  ["display", "Display"],
  ["position", "Position"],
  ["inset", "Inset"],
  ["fontSize", "Font size"],
  ["fontWeight", "Font weight"],
  ["color", "Text color"],
  ["backgroundColor", "Background"],
  ["borderRadius", "Radius"],
  ["gap", "Gap"],
  ["gridTemplateColumns", "Grid columns"],
  ["alignItems", "Align items"],
  ["justifyContent", "Justify content"],
  ["boxShadow", "Shadow"],
  ["backgroundSize", "Background size"],
  ["backgroundPosition", "Background position"],
] as const;

function propertyLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .replace(/^Col(\d)/, "Column $1");
}

function componentChildren(block: CmsBlock): ComponentNode[] {
  const child = (
    key: string,
    label: string,
    propertyKey?: string,
    arrayIndex?: number,
  ): ComponentNode => ({
    id: componentChildId(block, key),
    label,
    blockId: block.id,
    depth: 1,
    propertyKey,
    arrayIndex,
  });
  const definition = getCmsComponentDefinition(block.componentId ?? block.type);
  return (definition?.props.map((item) => item.key) ?? []).map((key) =>
    child(key, propertyLabel(key), key),
  );
}

function buildComponentTree(blocks: CmsBlock[]): ComponentNode[] {
  const byType = new Map(blocks.map((block) => [block.type, block]));
  const fixedChild = (
    block: CmsBlock,
    key: string,
    label: string,
    children: ComponentNode[] = [],
    depth = 1,
  ): ComponentNode => ({
    id: componentChildId(block, key),
    label,
    blockId: block.id,
    depth,
    fixed: true,
    children,
  });

  const header = byType.get("storefront_header");
  const navigation = byType.get("header_navigation");
  const actions = byType.get("header_actions");
  const footer = byType.get("storefront_footer");
  const footerColumns = byType.get("footer_columns");
  const headerTree = header
    ? {
        id: header.id,
        label: LABELS[header.type] ?? header.type,
        blockId: header.id,
        depth: 0,
        fixed: true,
        children: navigation
          ? [
              {
                ...fixedChild(
                  header,
                  "navigation",
                  LABELS[navigation.type] ?? navigation.type,
                ),
                children: [
                  fixedChild(navigation, "brand", "Brand", [], 2),
                  ...(actions
                    ? [
                        fixedChild(
                          actions,
                          "self",
                          LABELS[actions.type] ?? actions.type,
                          [],
                          2,
                        ),
                      ]
                    : []),
                ],
              },
            ]
          : [],
      }
    : null;
  const footerTree = footer
    ? {
        id: footer.id,
        label: LABELS[footer.type] ?? footer.type,
        blockId: footer.id,
        depth: 0,
        fixed: true,
        children: footerColumns
          ? [
              {
                ...fixedChild(
                  footer,
                  "columns",
                  LABELS[footerColumns.type] ?? footerColumns.type,
                ),
                children: [
                  fixedChild(footer, "brand", "Brand", [], 2),
                  fixedChild(footer, "shopLinks", "Shop links", [], 2),
                  fixedChild(footer, "supportLinks", "Support links", [], 2),
                  fixedChild(footer, "socialLinks", "Social links", [], 2),
                ],
              },
            ]
          : [],
      }
    : null;

  return blocks.flatMap((block) => {
    if (block.type === "storefront_header")
      return headerTree ? [headerTree] : [];
    if (block.type === "storefront_footer")
      return footerTree ? [footerTree] : [];
    if (
      block.type === "header_navigation" ||
      block.type === "header_actions" ||
      block.type === "footer_columns"
    )
      return [];
    return [
      {
        id: block.id,
        label: LABELS[block.type] ?? block.type,
        blockId: block.id,
        depth: 0,
        fixed: FIXED_COMPONENT_TYPES.has(block.type),
        children: [
          ...componentChildren(block),
          ...Object.entries(block.slots ?? {}).flatMap(([slot, instances]) => [
            {
              id: `${block.id}::slot::${slot}`,
              label: slot,
              blockId: block.id,
              depth: 1,
              fixed: true,
              children: componentInstanceNodes(block, instances, 2),
            },
          ]),
        ],
      },
    ];
  });
}

function flattenComponentTree(nodes: ComponentNode[]): ComponentNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenComponentTree(node.children ?? []),
  ]);
}

function ComponentTree({
  nodes,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: {
  nodes: ComponentNode[];
  selectedId: string | null;
  onSelect: (_node: ComponentNode) => void;
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <div key={node.id}>
          <div
            className={`flex min-h-7 items-center rounded text-xs transition-colors ${selectedId === node.id ? "bg-slate-100" : "hover:bg-slate-50"}`}
            style={{ paddingLeft: `${8 + node.depth * 16}px` }}
          >
            {node.children?.length ? (
              <button
                type="button"
                onClick={() => onToggle(node.id)}
                className="grid size-6 shrink-0 place-items-center rounded text-slate-400 hover:text-slate-700"
                aria-label={`${expandedIds.has(node.id) ? "Collapse" : "Expand"} ${node.label}`}
                aria-expanded={expandedIds.has(node.id)}
              >
                {expandedIds.has(node.id) ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </button>
            ) : (
              <span className="size-6 shrink-0" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => onSelect(node)}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left ${selectedId === node.id ? "font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-slate-300"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {node.fixed ? (
                <span className="text-[9px] text-slate-400">global</span>
              ) : null}
            </button>
          </div>
          {node.children?.length ? (
            expandedIds.has(node.id) ? (
              <ComponentTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggle={onToggle}
              />
            ) : null
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LayoutFields({
  block,
  disabled,
  onChange,
  onAccessibilityChange,
}: {
  block: CmsBlock;
  disabled: boolean;
  onChange: (_layout: Record<string, unknown>) => void;
  onAccessibilityChange: (_accessibility: Record<string, unknown>) => void;
}) {
  const layout =
    block.props.layout && typeof block.props.layout === "object"
      ? (block.props.layout as Record<string, unknown>)
      : {};
  const accessibility =
    block.props.accessibility && typeof block.props.accessibility === "object"
      ? (block.props.accessibility as Record<string, unknown>)
      : {};
  return (
    <details className="rounded border border-slate-200" open>
      <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-slate-600">
        Layout
      </summary>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-2.5">
        {LAYOUT_FIELDS.map(([key, label]) => (
          <label key={key} className="text-[10px] text-slate-500">
            {label}
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={text(layout[key])}
              onChange={(event) =>
                onChange({ ...layout, [key]: event.target.value })
              }
              disabled={disabled}
              placeholder="auto"
            />
          </label>
        ))}
        <label className="col-span-2 text-[10px] text-slate-500">
          Semantic element
          <select
            className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
            value={text(accessibility.semanticTag, "section")}
            onChange={(event) =>
              onAccessibilityChange({
                ...accessibility,
                semanticTag: event.target.value,
              })
            }
            disabled={disabled}
          >
            {[
              "div",
              "section",
              "article",
              "header",
              "nav",
              "main",
              "aside",
              "footer",
            ].map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        {["ariaLabel", "ariaDescription", "role", "tabIndex"].map((key) => (
          <label key={key} className="text-[10px] text-slate-500">
            {propertyLabel(key)}
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={text(accessibility[key])}
              onChange={(event) =>
                onAccessibilityChange({
                  ...accessibility,
                  [key]: event.target.value,
                })
              }
              disabled={disabled}
            />
          </label>
        ))}
        <p className="col-span-2 text-[10px] leading-4 text-slate-400">
          Responsive overrides are stored with the component instance and
          applied by the storefront preview.
        </p>
      </div>
    </details>
  );
}

function BlockPropertyFields({
  block,
  definition,
  disabled,
  onChange,
  focus,
  onPickMedia,
}: {
  block: CmsBlock;
  definition?: CmsComponentDefinition;
  disabled: boolean;
  onChange: (_key: string, _value: unknown) => void;
  focus?: Pick<ComponentNode, "propertyKey" | "arrayIndex">;
  onPickMedia?: (_key: string) => void;
}) {
  const registryProps = definition?.props ?? [];
  const keys = focus?.propertyKey
    ? [focus.propertyKey]
    : registryProps.length
      ? registryProps.map((item) => item.key)
      : (definition?.props.map((item) => item.key) ?? []);
  if (!keys.length)
    return (
      <p className="text-xs text-slate-500">
        This custom block has no typed controls. Use the structured settings
        below.
      </p>
    );
  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const registryProp = registryProps.find((item) => item.key === key);
        const rawValue = block.props[key];
        const value =
          focus?.arrayIndex !== undefined && Array.isArray(rawValue)
            ? rawValue[focus.arrayIndex]
            : rawValue;
        if (focus?.arrayIndex !== undefined && Array.isArray(rawValue))
          return (() => {
            const arrayIndex = focus.arrayIndex;
            const item = rawValue[arrayIndex];
            if (
              key === "tiles" &&
              item &&
              typeof item === "object" &&
              !Array.isArray(item)
            ) {
              const tile = item as Record<string, unknown>;
              return (
                <div
                  key={key}
                  className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Category tile {arrayIndex + 1}
                  </p>
                  {(["title", "subtitle", "linkLabel", "href"] as const).map(
                    (field) => (
                      <label
                        key={field}
                        className="block text-[11px] text-slate-500"
                      >
                        {propertyLabel(field)}
                        <input
                          className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                          value={text(tile[field])}
                          onChange={(event) => {
                            const next = [...rawValue];
                            next[arrayIndex] = {
                              ...tile,
                              [field]: event.target.value,
                            };
                            onChange(key, next);
                          }}
                          disabled={disabled}
                        />
                      </label>
                    ),
                  )}
                  <label className="block text-[11px] text-slate-500">
                    Background image URL
                    <input
                      className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                      value={text(tile.imageUrl)}
                      onChange={(event) => {
                        const next = [...rawValue];
                        next[arrayIndex] = {
                          ...tile,
                          imageUrl: event.target.value,
                        };
                        onChange(key, next);
                      }}
                      disabled={disabled}
                      placeholder="https://..."
                    />
                  </label>
                  {onPickMedia ? (
                    <button
                      type="button"
                      className="h-8 w-full rounded border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => onPickMedia(`tiles:${arrayIndex}`)}
                      disabled={disabled}
                    >
                      Choose from catalog media
                    </button>
                  ) : null}
                </div>
              );
            }
            return (
              <label key={key} className="block text-[11px] text-slate-500">
                {registryProp?.label ?? propertyLabel(key)}
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700"
                  value={JSON.stringify(value ?? {}, null, 2)}
                  onChange={(event) => {
                    try {
                      const next = [...rawValue];
                      next[arrayIndex] = JSON.parse(event.target.value);
                      onChange(key, next);
                    } catch {
                      /* Keep the draft editable until it is valid JSON. */
                    }
                  }}
                  disabled={disabled}
                />
              </label>
            );
          })();
        if (typeof value === "boolean")
          return (
            <label
              key={key}
              className="flex items-center gap-2 text-xs text-slate-600"
            >
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => onChange(key, event.target.checked)}
                disabled={disabled}
              />
              {registryProp?.label ?? propertyLabel(key)}
            </label>
          );
        if (Array.isArray(value))
          return (
            <label key={key} className="block text-[11px] text-slate-500">
              {registryProp?.label ?? propertyLabel(key)}
              <textarea
                className="mt-1 min-h-24 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700"
                value={JSON.stringify(value, null, 2)}
                onChange={(event) => {
                  try {
                    onChange(key, JSON.parse(event.target.value));
                  } catch {
                    /* Keep the draft editable until it is valid JSON. */
                  }
                }}
                disabled={disabled}
              />
            </label>
          );
        const multiline =
          key === "html" ||
          key === "hours" ||
          key === "slugs" ||
          (key === "title" && block.type === "hero") ||
          key.endsWith("Body");
        if (key === "mediaType")
          return (
            <label key={key} className="block text-[11px] text-slate-500">
              {registryProp?.label ?? "Hero media type"}
              <select
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={text(value, "image")}
                onChange={(event) => onChange(key, event.target.value)}
                disabled={disabled}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
          );
        return (
          <label key={key} className="block text-[11px] text-slate-500">
            {registryProp?.label ?? propertyLabel(key)}
            {multiline ? (
              <textarea
                className="mt-1 min-h-20 w-full rounded border border-slate-200 bg-white p-2 text-xs text-slate-700"
                value={text(value)}
                onChange={(event) => onChange(key, event.target.value)}
                disabled={disabled}
              />
            ) : (
              <input
                type={key === "heightPx" ? "number" : "text"}
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={text(value)}
                onChange={(event) =>
                  onChange(
                    key,
                    key === "heightPx"
                      ? Number(event.target.value) || 0
                      : event.target.value,
                  )
                }
                disabled={disabled}
                placeholder={
                  key.endsWith("Url") || key === "href"
                    ? "https:// or /path"
                    : undefined
                }
              />
            )}
            {onPickMedia &&
            (key === "imageUrl" || key === "videoUrl" || key === "src") ? (
              <button
                type="button"
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                onClick={() => onPickMedia(key)}
                disabled={disabled}
              >
                Choose from catalog media
              </button>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

function VisualPropertyFields({
  block,
  definition,
  disabled,
  onChange,
  onPickMedia,
}: {
  block: CmsBlock;
  definition: VisualComponentDefinition;
  disabled: boolean;
  onChange: (_key: string, _value: string | boolean) => void;
  onPickMedia?: (_key: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] leading-4 text-slate-400">
        Properties are copied from the Vvveb component registration and apply to
        the source markup.
      </p>
      {definition.properties.map((property) => {
        const raw = block.props[property.key];
        const value = typeof raw === "boolean" ? raw : text(raw);
        const options = property.options?.length
          ? property.options
          : property.validValues?.map((item) => ({ value: item, text: item }));
        if (property.inputtype === "checkbox") {
          return (
            <label
              key={property.key}
              className="flex items-center gap-2 text-xs text-slate-600"
            >
              <input
                type="checkbox"
                checked={Boolean(raw)}
                onChange={(event) =>
                  onChange(property.key, event.target.checked)
                }
                disabled={disabled}
              />
              {property.name}
            </label>
          );
        }
        if (property.inputtype === "select" && options?.length) {
          return (
            <label
              key={property.key}
              className="block text-[11px] text-slate-500"
            >
              {property.name}
              <select
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={String(value)}
                onChange={(event) => onChange(property.key, event.target.value)}
                disabled={disabled}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.text}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        const multiline =
          property.inputtype === "textarea" || property.key === "innerHTML";
        return (
          <label
            key={property.key}
            className="block text-[11px] text-slate-500"
          >
            {property.name}
            {multiline ? (
              <textarea
                className="mt-1 min-h-20 w-full rounded border border-slate-200 bg-white p-2 text-xs text-slate-700"
                value={String(value)}
                onChange={(event) => onChange(property.key, event.target.value)}
                disabled={disabled}
              />
            ) : (
              <input
                type={
                  property.inputtype === "number"
                    ? "number"
                    : property.inputtype === "url"
                      ? "url"
                      : "text"
                }
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={String(value)}
                onChange={(event) => onChange(property.key, event.target.value)}
                disabled={disabled}
              />
            )}
            {property.inputtype === "image" && onPickMedia ? (
              <button
                type="button"
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                onClick={() => onPickMedia(property.key)}
                disabled={disabled}
              >
                Choose from catalog media
              </button>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

type CmsToolId =
  | "pages"
  | "site-map"
  | "navigation"
  | "announcement"
  | "categories"
  | "media"
  | "blog"
  | "forms"
  | "redirects"
  | "experiments"
  | "commerce";

const CatalogMediaPickerDialog = dynamic(
  () =>
    import("@/components/catalog/CatalogMediaPickerDialog").then(
      (module) => module.CatalogMediaPickerDialog,
    ),
  { ssr: false },
);
const CmsPagesManager = dynamic(
  () => import("./CmsPagesManager").then((module) => module.CmsPagesManager),
  { ssr: false },
);
const CmsSiteMapPanel = dynamic(
  () => import("./CmsSiteMapPanel").then((module) => module.CmsSiteMapPanel),
  { ssr: false },
);
const CmsNavigationEditor = dynamic(
  () =>
    import("./CmsNavigationEditor").then(
      (module) => module.CmsNavigationEditor,
    ),
  { ssr: false },
);
const CmsAnnouncementEditor = dynamic(
  () =>
    import("./CmsAnnouncementEditor").then(
      (module) => module.CmsAnnouncementEditor,
    ),
  { ssr: false },
);
const CmsCategoryEditor = dynamic(
  () =>
    import("./CmsCategoryEditor").then((module) => module.CmsCategoryEditor),
  { ssr: false },
);
const CmsMediaManager = dynamic(
  () => import("./CmsMediaManager").then((module) => module.CmsMediaManager),
  { ssr: false },
);
const CmsBlogManager = dynamic(
  () => import("./CmsBlogManager").then((module) => module.CmsBlogManager),
  { ssr: false },
);
const CmsFormsTable = dynamic(
  () => import("./CmsFormsTable").then((module) => module.CmsFormsTable),
  { ssr: false },
);
const CmsRedirectsManager = dynamic(
  () =>
    import("./CmsRedirectsManager").then(
      (module) => module.CmsRedirectsManager,
    ),
  { ssr: false },
);
const CmsExperimentsManager = dynamic(
  () =>
    import("./CmsExperimentsManager").then(
      (module) => module.CmsExperimentsManager,
    ),
  { ssr: false },
);
const CmsCommerceSearch = dynamic(
  () =>
    import("./CmsCommerceSearch").then((module) => module.CmsCommerceSearch),
  { ssr: false },
);

const CMS_TOOL_SURFACES: Record<CmsToolId, ComponentType> = {
  pages: CmsPagesManager,
  "site-map": CmsSiteMapPanel,
  navigation: CmsNavigationEditor,
  announcement: CmsAnnouncementEditor,
  categories: CmsCategoryEditor,
  media: CmsMediaManager,
  blog: CmsBlogManager,
  forms: CmsFormsTable,
  redirects: CmsRedirectsManager,
  experiments: CmsExperimentsManager,
  commerce: CmsCommerceSearch,
};

function CmsToolSurface({ tool }: { tool: CmsToolId }) {
  const Surface = CMS_TOOL_SURFACES[tool];
  return (
    <div className="mx-auto w-full max-w-6xl rounded-xl bg-background p-4 shadow-xl ring-1 ring-foreground/10 sm:p-6">
      <Surface />
    </div>
  );
}

export function CmsPageBuilder({
  value,
  onChange,
  disabled,
  previewUrl,
  pages = [],
  currentPageId,
  onSelectPage,
  onNewPage,
  onDeletePage,
  onDuplicatePage,
  onPreviewPage,
  pageTitle,
  pageBody,
  onPageBodyChange,
  onSave,
  settings,
  toolbarActions,
  onClose,
  immersive = false,
  previewMode = "page",
  onMutation,
}: {
  value: unknown;
  onChange: (_blocks: CmsBlock[]) => void;
  onMutation?: (_mutation: CmsMutationShape) => void;
  disabled: boolean;
  previewUrl: string;
  pages?: BuilderPage[];
  currentPageId?: string;
  onSelectPage?: (_id: string) => void;
  onNewPage?: () => void;
  onDeletePage?: (_id: string) => void;
  onDuplicatePage?: (_id: string) => void;
  onPreviewPage?: (_id: string) => void;
  pageTitle?: string;
  pageBody?: string;
  onPageBodyChange?: (_body: string) => void;
  onSave?: (_blocks: CmsBlock[]) => void;
  settings?: ReactNode;
  toolbarActions?: ReactNode;
  onClose?: () => void;
  immersive?: boolean;
  previewMode?: "home" | "page";
}) {
  const blocks = useMemo(() => normalize(value), [value]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null,
  );
  const [device, setDevice] = useState<
    "desktop" | "laptop" | "tablet-landscape" | "tablet" | "mobile" | null
  >("desktop");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<
    | "pages"
    | "components"
    | "sections"
    | "layers"
    | "files"
    | "configuration"
    | "ai"
  >("pages");
  const [activeTool, setActiveTool] = useState<CmsToolId | null>(null);
  // Kept internally for the existing component-definition editor state; the
  // reference workflow exposes components from the Components panel rather
  // than adding a separate custom canvas mode to the toolbar.
  const [builderMode, setBuilderMode] = useState<"instance" | "canvas">(
    "instance",
  );
  const [componentCanvasId, _setComponentCanvasId] = useState<string | null>(
    null,
  );
  const [zoom, setZoom] = useState(100);
  const [breakpointsOpen, setBreakpointsOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [styleState, setStyleState] = useState("");
  const [styleTheme, setStyleTheme] = useState<StyleTheme>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [rightTab, setRightTab] = useState<
    | "content"
    | "layout"
    | "style"
    | "responsive"
    | "advanced"
    | "code"
    | "settings"
  >("content");
  const [history, setHistory] = useState<CmsHistory>(() => createCmsHistory());
  const [presets, setPresets] = useState<CmsPageBlockPresetRow[]>([]);
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [pageQuery, setPageQuery] = useState("");
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [paletteTab, setPaletteTab] = useState<"components" | "sections">(
    "components",
  );
  const [sectionPaletteTab, setSectionPaletteTab] = useState<
    "sections" | "page-sections"
  >("sections");
  const [paletteQuery, setPaletteQuery] = useState("");
  const [configurationTab, setConfigurationTab] = useState<
    "styles" | "variables"
  >("styles");
  const [stylesBaseOpen, setStylesBaseOpen] = useState(true);
  const [configurationQuery, setConfigurationQuery] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantAttachment, setAssistantAttachment] = useState<string | null>(
    null,
  );
  const [voiceListening, setVoiceListening] = useState(false);
  const [assistantOptionsOpen, setAssistantOptionsOpen] = useState(false);
  const [assistantSessionsOpen, setAssistantSessionsOpen] = useState(false);
  const [assistantShowThinking, setAssistantShowThinking] = useState(true);
  const [assistantShowToolCalls, setAssistantShowToolCalls] = useState(false);
  const [assistantAllowScreenshots, setAssistantAllowScreenshots] =
    useState(true);
  const [assistantContextOpen, setAssistantContextOpen] = useState(false);
  const [assistantUsageOpen, setAssistantUsageOpen] = useState(false);
  const [cssVariables, setCssVariables] = useState<ColorPalette>({
    font: {},
    color: {},
    dimensions: {},
  });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedPaletteGroups, setCollapsedPaletteGroups] = useState<
    Set<string>
  >(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionRows, setRevisionRows] = useState<CmsRevisionRow[]>([]);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<string | null>(
    null,
  );
  const [propsDraft, setPropsDraft] = useState("");
  const [componentDefinitions, setComponentDefinitions] = useState<
    CmsComponentDefinition[]
  >(() => listCmsComponentDefinitions());
  const [componentVersions, setComponentVersions] = useState<
    Record<string, number>
  >({});
  const [componentStatuses, setComponentStatuses] = useState<
    Record<string, string>
  >({});
  const [canvasDraft, setCanvasDraft] = useState("");
  const [canvasVariantId, setCanvasVariantId] = useState<string | null>(null);
  const [canvasSavePending, setCanvasSavePending] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState<PreviewTarget | null>(
    null,
  );
  const [selectedPreview, setSelectedPreview] = useState<PreviewTarget | null>(
    null,
  );
  const visibleSelectedPreview =
    selectedPreview && selectedPreview.id === selectedComponentId
      ? selectedPreview
      : null;
  const rawPreviewRef = useRef<PreviewTarget | null>(null);
  const rawHoveredPreviewRef = useRef<PreviewTarget | null>(null);
  const selectedMessageKeyRef = useRef("");
  const sendDraftRef = useRef<(() => void) | null>(null);
  const previewReadyRef = useRef(false);
  const remeasureFrameRef = useRef<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const assistantFileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasScrollRef = useRef<HTMLElement>(null);
  const canvasVisualRef = useRef<HTMLIFrameElement>(null);
  const addInstanceToSlotRef = useRef<
    ((_slot: string, _componentId: string) => void) | null
  >(null);
  const addBlockRef = useRef<((_type: string) => void) | null>(null);
  const addVisualPrimitiveRef = useRef<((_type: string) => void) | null>(null);
  const blocksRef = useRef(blocks);
  const componentNodesRef = useRef<ComponentNode[]>([]);
  const commitRef = useRef<
    ((..._args: [CmsBlock[], string?, CmsMutationShape?]) => void) | null
  >(null);
  const previewOriginRef = useRef("");
  const zoomRef = useRef(zoom);
  const refreshCssVariables = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.contentWindow?.postMessage(
      { source: "cms-builder-css-request" },
      cmsPreviewTargetOrigin(frame, previewOriginRef.current),
    );
  }, []);
  const applyEditorFrameState = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.contentWindow?.postMessage(
      {
        source: "cms-builder-frame-state",
        state: styleState,
        theme: styleTheme,
        showHidden,
      },
      cmsPreviewTargetOrigin(frame, previewOriginRef.current),
    );
  }, [showHidden, styleState, styleTheme]);
  const componentTree = useMemo(() => buildComponentTree(blocks), [blocks]);
  const revisions = useMemo(
    () =>
      Array.from(
        new Map(revisionRows.map((row) => [row.revision, row])).values(),
      ),
    [revisionRows],
  );
  const restoreRevision = useCallback(
    (revision: number) => {
      let next = blocks;
      const laterMutations = revisionRows
        .filter((row) => row.revision > revision)
        .sort((a, b) => b.revision - a.revision || b.sequence - a.sequence);
      for (const row of laterMutations) {
        const restored = applyCmsMutation(next, row.mutation, "before");
        if (!restored) {
          setMessage(
            `Revision ${revision} cannot be restored from the saved mutation history.`,
          );
          return;
        }
        next = restored;
      }
      onChange(next);
      setHistory(createCmsHistory());
      setRevisionsOpen(false);
      setMessage(
        `Revision ${revision} loaded. Save the page to keep this version.`,
      );
    },
    [blocks, onChange, revisionRows],
  );
  const componentNodes = useMemo(
    () => flattenComponentTree(componentTree),
    [componentTree],
  );
  const selectedComponent = componentNodes.find(
    (node) => node.id === selectedComponentId,
  );
  const selected =
    blocks.find(
      (block) => block.id === (selectedComponent?.blockId ?? selectedId),
    ) ?? null;
  const selectedInstance = useMemo(
    () =>
      selectedComponent && selectedComponent.id !== selected?.id
        ? findComponentInstance(
            selected?.slots &&
              Object.values(selected.slots).flatMap((items) => items),
            selectedComponent.id,
          )
        : null,
    [selected, selectedComponent],
  );
  useEffect(() => {
    if (!revisionsOpen || !currentPageId) return;
    let active = true;
    setRevisionsLoading(true);
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/cms/pages/${encodeURIComponent(currentPageId)}/mutations`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Unable to load revisions");
        const payload = await readResponseJson<{
          data?: CmsRevisionRow[];
        } | null>(response, null);
        if (active) setRevisionRows(payload?.data ?? []);
      } catch {
        if (active) setRevisionRows([]);
      } finally {
        if (active) setRevisionsLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [currentPageId, revisionsOpen]);
  const selectedEditorBlock = useMemo(
    () =>
      selected && selectedInstance
        ? {
            ...selected,
            id: selectedInstance.id,
            componentId: selectedInstance.componentId,
            variantId: selectedInstance.variantId,
            props: resolvedComponentProps(
              resolveCmsComponentDefinition(
                componentDefinitions,
                selectedInstance.componentId,
              ),
              selectedInstance.variantId,
              selectedInstance.props,
            ),
            slots: selectedInstance.slots,
          }
        : selected,
    [componentDefinitions, selected, selectedInstance],
  );
  const selectedPreviewFocus = useMemo<ComponentNode | undefined>(() => {
    if (
      !visibleSelectedPreview?.propertyKey ||
      visibleSelectedPreview.arrayIndex === null ||
      visibleSelectedPreview.arrayIndex === undefined ||
      !selected
    ) {
      return undefined;
    }
    return {
      id: visibleSelectedPreview.parentId ?? visibleSelectedPreview.id,
      label: visibleSelectedPreview.label,
      blockId: selected.id,
      depth: 1,
      propertyKey: visibleSelectedPreview.propertyKey,
      arrayIndex: visibleSelectedPreview.arrayIndex,
    };
  }, [selected, visibleSelectedPreview]);
  const grouped = useMemo(
    () =>
      BLOCK_TYPES.reduce<Record<string, (typeof BLOCK_TYPES)[number][]>>(
        (acc, item) => {
          (acc[item.group] ??= []).push(item);
          return acc;
        },
        {},
      ),
    [],
  );
  const groupedDefinitions = useMemo(
    () =>
      componentDefinitions.reduce<Record<string, CmsComponentDefinition[]>>(
        (acc, definition) => {
          const group = componentPaletteGroup(definition.category);
          (acc[group] ??= []).push(definition);
          return acc;
        },
        {},
      ),
    [componentDefinitions],
  );
  const groupedSourceDefinitions = useMemo(
    () =>
      UVS_DEFINITIONS.reduce<Record<string, VisualComponentDefinition[]>>(
        (acc, definition) => {
          const group = sourcePaletteGroup(definition.type);
          const items = (acc[group] ??= []);
          if (!items.some((item) => item.type === definition.type))
            items.push(definition);
          return acc;
        },
        {},
      ),
    [],
  );
  const paletteGroups = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(groupedDefinitions),
          ...Object.keys(groupedSourceDefinitions),
        ]),
      )
        .map((group) => [group, null] as [string, null])
        .sort(comparePaletteGroups)
        .map(([group]) => group),
    [groupedDefinitions, groupedSourceDefinitions],
  );
  const selectedDefinition = useMemo<CmsComponentDefinition | undefined>(() => {
    const id =
      selectedEditorBlock?.componentId ??
      selectedEditorBlock?.type.replaceAll("_", "-");
    return id
      ? resolveCmsComponentDefinition(componentDefinitions, id)
      : undefined;
  }, [componentDefinitions, selectedEditorBlock]);
  const selectedVisualDefinition = useMemo(
    () => visualDefinitionForBlock(selectedEditorBlock),
    [selectedEditorBlock],
  );
  const canvasDefinition = useMemo(
    () =>
      componentCanvasId
        ? resolveCmsComponentDefinition(componentDefinitions, componentCanvasId)
        : undefined,
    [componentCanvasId, componentDefinitions],
  );
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/cms/components", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await readResponseJson<{
          data?: CmsComponentDefinition[];
          meta?: {
            records?: Array<{ id: string; version: number; status?: string }>;
          };
        } | null>(response, null);
        if (!payload?.data?.length) return;
        setComponentDefinitions(payload.data.map(canonicalCmsBlockDefinition));
        setComponentVersions(
          Object.fromEntries(
            (payload.meta?.records ?? []).map((record) => [
              record.id,
              record.version,
            ]),
          ),
        );
        setComponentStatuses(
          Object.fromEntries(
            (payload.meta?.records ?? []).map((record) => [
              record.id,
              record.status ?? "draft",
            ]),
          ),
        );
      } catch {
        // The editor can continue with the local component registry when the CMS API is unavailable.
      }
    })();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setCanvasDraft(
      canvasDefinition ? JSON.stringify(canvasDefinition, null, 2) : "",
    );
    setCanvasVariantId(
      canvasDefinition?.defaultVariantId ??
        canvasDefinition?.variants[0]?.id ??
        null,
    );
  }, [canvasDefinition]);
  const canvasDraftDefinition = useMemo<CmsComponentDefinition | null>(() => {
    try {
      const parsed = JSON.parse(canvasDraft) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as CmsComponentDefinition)
        : (canvasDefinition ?? null);
    } catch {
      return canvasDefinition ?? null;
    }
  }, [canvasDefinition, canvasDraft]);
  const canvasVisualBlock = useMemo<CmsBlock | null>(() => {
    if (!canvasDraftDefinition) return null;
    const variantId =
      canvasVariantId ??
      canvasDraftDefinition.defaultVariantId ??
      canvasDraftDefinition.variants[0]?.id ??
      "default";
    return {
      id: `canvas-${canvasDraftDefinition.id}-${variantId}`,
      type: canvasDraftDefinition.id.replaceAll("-", "_"),
      componentId: canvasDraftDefinition.id,
      variantId,
      props: resolvedComponentProps(canvasDraftDefinition, variantId, {}),
      slots: Object.fromEntries(
        canvasDraftDefinition.slots.map((slot) => [slot.name, []]),
      ),
    };
  }, [canvasDraftDefinition, canvasVariantId]);
  const canvasVisualDocument = useMemo(
    () =>
      canvasVisualBlock
        ? componentCanvasDocument(
            canvasVisualBlock,
            canvasDraftDefinition ?? undefined,
          )
        : "",
    [canvasDraftDefinition, canvasVisualBlock],
  );
  const canvasVariantPreviewDocuments = useMemo(() => {
    if (!canvasDefinition) return new Map<string, string>();
    return new Map(
      canvasDefinition.variants.map((variant) => [
        variant.id,
        componentCanvasDocument(
          createComponentCanvasPreviewBlock(canvasDefinition, variant.id),
          canvasDefinition,
        ),
      ]),
    );
  }, [canvasDefinition]);
  const updateCanvasVisualProp = useCallback(
    (key: string, value: string) => {
      if (!canvasDefinition || !canvasVisualBlock) return;
      let raw: unknown;
      try {
        raw = JSON.parse(canvasDraft);
      } catch {
        return;
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const definition = raw as CmsComponentDefinition;
      const variantId =
        canvasVisualBlock.variantId ??
        definition.defaultVariantId ??
        definition.variants[0]?.id;
      const variant = definition.variants.find((item) => item.id === variantId);
      if (!variant || !definition.props.some((item) => item.key === key))
        return;
      variant.props = { ...(variant.props ?? {}), [key]: value };
      setCanvasDraft(JSON.stringify(definition, null, 2));
    },
    [canvasDefinition, canvasDraft, canvasVisualBlock],
  );
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = canvasVisualRef.current?.contentWindow;
      if (
        !frame ||
        event.source !== frame ||
        (event.origin !== window.location.origin && event.origin !== "null")
      )
        return;
      const message = cmsComponentCanvasMutationSchema.safeParse(event.data);
      if (!message.success) return;
      if ("event" in message.data && message.data.event === "slot-drop") {
        addInstanceToSlotRef.current?.(
          message.data.slot,
          message.data.componentId,
        );
        return;
      }
      if ("property" in message.data)
        updateCanvasVisualProp(message.data.property, message.data.value);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [updateCanvasVisualProp]);
  const saveCanvasDefinition = useCallback(async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(canvasDraft);
    } catch {
      setMessage("Component definition must be valid JSON.");
      return;
    }
    const parsed = cmsComponentDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
      setMessage(
        "Component definition is invalid. Check required fields and variants.",
      );
      return;
    }
    setCanvasSavePending(true);
    try {
      const payload = await new UvsCmsClient(
        fetch,
        window.location.origin,
      ).saveComponentDefinition(
        parsed.data,
        componentVersions[parsed.data.id],
        `cms-component-${parsed.data.id}-${Date.now()}`,
      );
      const saved = cmsComponentDefinitionSchema.parse(
        payload.definition,
      ) as CmsComponentDefinition;
      setComponentDefinitions((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? canonicalCmsBlockDefinition(saved) : item))
          : [...current, canonicalCmsBlockDefinition(saved)],
      );
      setComponentVersions((current) => ({
        ...current,
        [saved.id]: payload.version ?? (current[saved.id] ?? 0) + 1,
      }));
      setCanvasDraft(JSON.stringify(saved, null, 2));
      setMessage("Main component saved.");
    } finally {
      setCanvasSavePending(false);
    }
  }, [canvasDraft, componentVersions]);
  const publishCanvasDefinition = useCallback(async () => {
    if (!canvasDefinition) return;
    const version = componentVersions[canvasDefinition.id];
    if (!version) {
      setMessage("Save the definition before publishing it.");
      return;
    }
    setCanvasSavePending(true);
    try {
      const payload = await new UvsCmsClient(
        fetch,
        window.location.origin,
      ).publishComponent(
        canvasDefinition.id,
        version,
        `cms-component-publish-${canvasDefinition.id}-${Date.now()}`,
      );
      const data =
        payload && typeof payload === "object"
          ? (payload as { definition?: unknown; version?: number })
          : {};
      const published = data.definition
        ? (cmsComponentDefinitionSchema.parse(
            data.definition,
          ) as CmsComponentDefinition)
        : canvasDefinition;
      setComponentDefinitions((current) =>
        current.map((item) => (item.id === published.id ? canonicalCmsBlockDefinition(published) : item)),
      );
      setComponentVersions((current) => ({
        ...current,
        [published.id]: data.version ?? version,
      }));
      setComponentStatuses((current) => ({
        ...current,
        [published.id]: "published",
      }));
      setCanvasDraft(JSON.stringify(published, null, 2));
      setMessage("Component definition published.");
    } finally {
      setCanvasSavePending(false);
    }
  }, [canvasDefinition, componentVersions]);

  const commit = useCallback(
    (next: CmsBlock[], select?: string, mutation?: CmsMutationShape) => {
      const persistedMutation = persistedCmsMutation(blocks, next, mutation);
      setHistory(recordCmsCommand(history, blocks, next, persistedMutation));
      onChange(next);
      if (persistedMutation) onMutation?.(persistedMutation);
      if (select) {
        setSelectedId(select);
        setSelectedComponentId(select);
      }
    },
    [blocks, history, onChange, onMutation],
  );
  useEffect(() => {
    blocksRef.current = blocks;
    componentNodesRef.current = componentNodes;
    commitRef.current = commit;
    zoomRef.current = zoom;
  }, [blocks, componentNodes, commit, zoom]);
  useEffect(() => {
    if (!selectedId || !blocks.some((b) => b.id === selectedId)) {
      if (selectedId) setSelectedId(null);
    }
    if (
      selectedComponentId &&
      !selectedComponentId.startsWith("cms-dom-") &&
      !componentNodes.some((node) => node.id === selectedComponentId)
    ) {
      setSelectedComponentId(null);
    }
  }, [blocks, componentNodes, selectedComponentId, selectedId]);
  useEffect(() => {
    setPropsDraft(
      selectedEditorBlock
        ? JSON.stringify(selectedEditorBlock.props, null, 2)
        : "",
    );
  }, [selectedEditorBlock]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/cms/block-presets", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await readResponseJson<{
          data?: CmsPageBlockPresetRow[];
        } | null>(response, null);
        if (payload) setPresets(payload.data ?? []);
      } catch {
        // Presets are an enhancement; an unavailable endpoint must not block the editor.
      }
    })();
    return () => controller.abort();
  }, []);
  const previewOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!previewUrl) return window.location.origin;
    try {
      return new URL(previewUrl, window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  }, [previewUrl]);
  const previewSandbox =
    typeof window === "undefined"
      ? "allow-scripts"
      : cmsPreviewSandbox(
          previewOrigin,
          window.location.origin,
          process.env.NODE_ENV !== "production",
        );
  useEffect(() => {
    previewOriginRef.current = previewOrigin;
  }, [previewOrigin]);
  const sendDomMutation = (property: string, value: string) => {
    const target = visibleSelectedPreview;
    if (!target?.id) return;
    const blockId = target.blockId ?? target.id.split("::", 1)[0];
    const current = blocksRef.current;
    const next = applyDomMutation(current, blockId, target.id, property, value);
    if (next === current) return;
    // Commit on blur synchronously in the parent state before a toolbar Save
    // click can read the previous React render. The next draft postMessage
    // refreshes the iframe from this persisted editor state.
    commitRef.current?.(next, undefined, {
      type: property === "textContent" ? "set-text" : "set-style",
      nodeId: target.id,
      key: property,
      after: value,
    });
    setMessage("Live element change recorded.");
  };
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const onLoad = () => {
      refreshCssVariables();
      applyEditorFrameState();
    };
    frame.addEventListener("load", onLoad);
    if (frame.contentWindow) {
      refreshCssVariables();
      applyEditorFrameState();
    }
    return () => {
      frame.removeEventListener("load", onLoad);
    };
  }, [applyEditorFrameState, previewUrl, refreshCssVariables]);
  useEffect(() => {
    if (leftTab === "configuration") refreshCssVariables();
  }, [leftTab, refreshCssVariables]);
  useEffect(() => {
    applyEditorFrameState();
  }, [applyEditorFrameState, previewUrl]);
  useEffect(() => {
    // Ignore fractional layout churn while iframe and host scrollbars settle.
    const EPSILON = 1;
    const sameRect = (
      left: PreviewTarget["rect"] | undefined,
      right: PreviewTarget["rect"] | undefined,
    ) =>
      Boolean(
        left &&
        right &&
        Math.abs(left.x - right.x) < EPSILON &&
        Math.abs(left.y - right.y) < EPSILON &&
        Math.abs(left.width - right.width) < EPSILON &&
        Math.abs(left.height - right.height) < EPSILON,
      );
    const toCanvasRect = (rect: PreviewTarget["rect"]) => {
      const frame = iframeRef.current;
      const canvas = frame?.parentElement;
      if (!frame || !canvas) return rect;
      const frameRect = frame.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return mapCmsPreviewRectToCanvas(rect, {
        frameLeft: frameRect.left,
        frameTop: frameRect.top,
        frameWidth: frameRect.width,
        frameHeight: frameRect.height,
        clientWidth: frame.clientWidth,
        clientHeight: frame.clientHeight,
        canvasLeft: canvasRect.left,
        canvasTop: canvasRect.top,
        zoom: zoomRef.current,
      });
    };
    const setMappedPreview = (
      setter: typeof setSelectedPreview,
      target: PreviewTarget | null,
    ) => {
      if (!target) {
        setter((current) => (current ? null : current));
        return;
      }
      const mapped = toCanvasRect(target.rect);
      setter((current) => {
        if (
          current?.id === target.id &&
          current.label === target.label &&
          sameRect(current.rect, mapped)
        ) {
          return current;
        }
        return { ...target, rect: mapped };
      });
    };
    const onMessage = (
      event: MessageEvent<{
        source?: string;
        id?: string | null;
        blockId?: string | null;
        label?: string;
        rect?: PreviewTarget["rect"];
        prop?: string;
        value?: string;
        tagName?: string;
        text?: string;
        href?: string;
        src?: string;
        style?: Record<string, string>;
        visualPath?: string;
        parentId?: string | null;
        propertyKey?: string | null;
        arrayIndex?: number | null;
        index?: number;
        componentId?: string;
      }>,
    ) => {
      const frame = iframeRef.current;
      if (
        !frame ||
        !previewOriginRef.current ||
        !isCmsPreviewMessageFromFrame(event, frame, previewOriginRef.current)
      ) return;
      const parsedMessage = cmsPreviewMessageSchema.safeParse(event.data);
      if (!parsedMessage.success) return;
      const data = parsedMessage.data as {
        source: string;
        id?: string | null;
        blockId?: string | null;
        label?: string;
        rect?: PreviewTarget["rect"];
        prop?: string;
        value?: string;
        tagName?: string;
        text?: string;
        href?: string;
        src?: string;
        style?: Record<string, string>;
        visualPath?: string;
        parentId?: string | null;
        propertyKey?: string | null;
        arrayIndex?: number | null;
        index?: number;
        componentId?: string;
      };
      const { source, id, blockId, rect, label, visualPath } = data;
      if (source === "cms-preview-css-variables") {
        const palette = (data as { palette?: ColorPalette }).palette;
        if (palette && typeof palette === "object") setCssVariables(palette);
        return;
      }
      if (source === "cms-preview-ready") {
        previewReadyRef.current = true;
        sendDraftRef.current?.();
        return;
      }
      if (source === "cms-builder-mutation") {
        const property = typeof data.prop === "string" ? data.prop : "";
        const value = typeof data.value === "string" ? data.value : "";
        if (!id || !property || property.length > 80 || value.length > 100_000)
          return;
        const next = applyPreviewMutation(
          blocksRef.current,
          id,
          property,
          value,
        );
        if (next !== blocksRef.current) {
          commitRef.current?.(next, id.split("::", 1)[0], {
            type: "set-prop",
            nodeId: id,
            key: property,
            after: value,
          });
          setMessage("Canvas change recorded.");
        }
        return;
      }
      if (source === "cms-builder-dom-mutation") {
        const property = typeof data.prop === "string" ? data.prop : "";
        const value = typeof data.value === "string" ? data.value : "";
        if (!id || !blockId || !property || value.length > 100_000) return;
        const next = applyDomMutation(
          blocksRef.current,
          blockId,
          id,
          property,
          value,
          visualPath,
        );
        if (next !== blocksRef.current) {
          // Keep the live DOM selection; selecting the owning block here makes
          // the inspector jump away from the element that was just edited.
          commitRef.current?.(next, undefined, {
            type: "set-style",
            nodeId: id,
            key: property,
            after: value,
          });
          setMessage("Live element change recorded.");
        }
        return;
      }
      if (source === "cms-builder-dom-drop") {
        if (!data.componentId || !data.parentId) return;
        if (data.componentId.startsWith("visual:"))
          addVisualPrimitiveRef.current?.(data.componentId.slice(7));
        else if (data.parentId.startsWith("slot:"))
          addInstanceToSlotRef.current?.(
            data.parentId.slice(5),
            data.componentId,
          );
        else addBlockRef.current?.(data.componentId.replaceAll("-", "_"));
        return;
      }
      if (source === "cms-builder-hover") {
        if (!id || !rect) {
          rawHoveredPreviewRef.current = null;
          setHoveredPreview((current) => (current ? null : current));
          return;
        }
        const target = {
          id,
          blockId,
          label: label ?? id,
          rect,
          tagName: data.tagName,
          text: data.text,
          href: data.href,
          src: data.src,
          style: data.style,
          parentId: data.parentId,
          propertyKey: data.propertyKey,
          arrayIndex: data.arrayIndex,
        };
        rawHoveredPreviewRef.current = target;
        const mapped = toCanvasRect(rect);
        setHoveredPreview((current) => {
          if (
            current?.id === id &&
            current.label === (label ?? id) &&
            sameRect(current.rect, mapped)
          ) {
            return current;
          }
          return { ...target, rect: mapped };
        });
        return;
      }
      if (source !== "cms-builder" || !id) return;
      if (rect) {
        const target = {
          id,
          blockId,
          label: label ?? id,
          rect,
          tagName: data.tagName,
          text: data.text,
          href: data.href,
          src: data.src,
          style: data.style,
          parentId: data.parentId,
          propertyKey: data.propertyKey,
          arrayIndex: data.arrayIndex,
        };
        rawPreviewRef.current = target;
        const mapped = toCanvasRect(rect);
        const key = `${id}:${Math.round(mapped.x)}:${Math.round(mapped.y)}:${Math.round(mapped.width)}:${Math.round(mapped.height)}`;
        if (selectedMessageKeyRef.current === key) return;
        selectedMessageKeyRef.current = key;
        setSelectedPreview((current) => {
          if (
            current?.id === id &&
            current.label === (label ?? id) &&
            sameRect(current.rect, mapped)
          ) {
            return current;
          }
          return { ...target, rect: mapped };
        });
      }
      const component = componentNodesRef.current.find(
        (node) => node.id === id,
      );
      const resolvedBlockId =
        blockId && blocksRef.current.some((block) => block.id === blockId)
          ? blockId
          : (component?.blockId ??
            (blocksRef.current.some((block) => block.id === id) ? id : null));
      if (!resolvedBlockId) return;
      setSelectedId((current) =>
        current === resolvedBlockId ? current : resolvedBlockId,
      );
      setSelectedComponentId((current) => (current === id ? current : id));
      setRightTab((current) => (current === "settings" ? current : "content"));
      setRightOpen((current) => (current ? current : true));
    };
    window.addEventListener("message", onMessage);
    const scrollContainer = canvasScrollRef.current;
    const remeasure = () => {
      if (remeasureFrameRef.current !== null) return;
      remeasureFrameRef.current = window.requestAnimationFrame(() => {
        remeasureFrameRef.current = null;
        const target = rawPreviewRef.current;
        if (target) setMappedPreview(setSelectedPreview, target);
        const hoveredTarget = rawHoveredPreviewRef.current;
        if (hoveredTarget) setMappedPreview(setHoveredPreview, hoveredTarget);
      });
    };
    scrollContainer?.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(remeasure);
    resizeObserver?.observe(iframeRef.current as Element);
    if (canvasScrollRef.current)
      resizeObserver?.observe(canvasScrollRef.current);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", remeasure);
    visualViewport?.addEventListener("scroll", remeasure);
    return () => {
      if (remeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(remeasureFrameRef.current);
        remeasureFrameRef.current = null;
      }
      window.removeEventListener("message", onMessage);
      scrollContainer?.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
      visualViewport?.removeEventListener("resize", remeasure);
      visualViewport?.removeEventListener("scroll", remeasure);
      resizeObserver?.disconnect();
    };
  }, []);
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !previewUrl) return;
    const sendDraft = () => {
      frame.contentWindow?.postMessage(
        {
          source: "cms-builder-draft",
          mode: previewMode,
          pageBody: pageBody ?? "",
          blocks,
          tree: cmsBlocksToTree(blocks),
        },
        cmsPreviewTargetOrigin(frame, previewOrigin),
      );
      if (selectedId) {
        frame.contentWindow?.postMessage(
          {
            source: "cms-builder-select",
            id: selectedComponentId ?? selectedId,
          },
          cmsPreviewTargetOrigin(frame, previewOrigin),
        );
      }
    };
    sendDraftRef.current = sendDraft;
    previewReadyRef.current = false;
    const onLoad = () => {
      previewReadyRef.current = true;
      sendDraft();
    };
    frame.addEventListener("load", onLoad);
    sendDraft();
    return () => {
      previewReadyRef.current = false;
      frame.removeEventListener("load", onLoad);
      if (sendDraftRef.current === sendDraft) sendDraftRef.current = null;
    };
  }, [
    blocks,
    pageBody,
    previewMode,
    previewOrigin,
    previewUrl,
    selectedComponentId,
    selectedId,
  ]);
  const addBlock = useCallback(
    (type: string) => {
      if (FIXED_COMPONENT_TYPES.has(type)) return;
      const definition = componentDefinitions.find(
        (item) => item.id === type.replaceAll("_", "-"),
      );
      const block = {
        id: makeId(),
        type,
        componentId: definition?.id,
        variantId: definition?.defaultVariantId,
        props: {
          ...getCmsDefaultProps(type),
          ...(definition?.props ?? []).reduce<Record<string, unknown>>(
            (acc, item) => {
              if (item.defaultValue !== undefined)
                acc[item.key] = item.defaultValue;
              return acc;
            },
            {},
          ),
          ...(definition?.variants.find(
            (variant) => variant.id === definition.defaultVariantId,
          )?.props ?? {}),
        },
        slots: definition?.slots.length ? {} : undefined,
      } satisfies CmsBlock;
      commit([...blocks, block], block.id);
    },
    [blocks, commit, componentDefinitions],
  );
  const addVisualPrimitive = useCallback(
    (type: string) => {
      const definition = UVS_DEFINITIONS.find((item) => item.type === type);
      if (!definition) return;
      const block: CmsBlock = {
        id: makeId(),
        type: "visual_primitive",
        componentId: `visual:${definition.type}`,
        props: {
          sourceType: definition.type,
          sourceName: definition.name,
          markup: definition.markup,
          ...visualInitialProps(definition),
        },
      };
      commit([...blocks, block], block.id);
    },
    [blocks, commit],
  );
  useEffect(() => {
    addBlockRef.current = addBlock;
    return () => {
      if (addBlockRef.current === addBlock) addBlockRef.current = null;
    };
  }, [addBlock]);
  useEffect(() => {
    addVisualPrimitiveRef.current = addVisualPrimitive;
    return () => {
      if (addVisualPrimitiveRef.current === addVisualPrimitive)
        addVisualPrimitiveRef.current = null;
    };
  }, [addVisualPrimitive]);
  const addComponentVariant = (
    definition: CmsComponentDefinition,
    variantId: string,
  ) => {
    const variant = definition.variants.find((item) => item.id === variantId);
    const type = definition.id.replaceAll("-", "_");
    const block = {
      id: makeId(),
      type,
      componentId: definition.id,
      variantId,
      props: {
        ...getCmsDefaultProps(type),
        ...definition.props.reduce<Record<string, unknown>>((acc, item) => {
          if (item.defaultValue !== undefined)
            acc[item.key] = item.defaultValue;
          return acc;
        }, {}),
        ...(variant?.props ?? {}),
      },
      slots: definition.slots.length ? {} : undefined,
    } satisfies CmsBlock;
    commit([...blocks, block], block.id);
    setBuilderMode("instance");
    setMessage(`${definition.name} added to the page.`);
  };
  const addInstanceToSlot = useCallback(
    (slotName: string, componentId: string) => {
      if (!selected || !selectedDefinition) {
        setMessage(
          "Select the matching component instance before adding a slot item.",
        );
        return;
      }
      const definition = componentDefinitions.find(
        (item) => item.id === componentId,
      );
      if (!definition) return;
      const slot = selectedDefinition?.slots.find(
        (item) => item.name === slotName,
      );
      if (!slot) return;
      const existing =
        selectedInstance?.slots?.[slotName] ??
        selected?.slots?.[slotName] ??
        [];
      if (!slot.multiple && existing.length) {
        setMessage(`${slot.label} accepts one component.`);
        return;
      }
      const type = definition.id.replaceAll("-", "_");
      const child = componentInstanceFromBlock({
        id: makeId(),
        type,
        componentId: definition.id,
        variantId: definition.defaultVariantId,
        props: getCmsDefaultProps(definition.id),
        slots: definition.slots.length ? {} : undefined,
      });
      const slotError =
        slot.allowedComponentIds?.length &&
        !slot.allowedComponentIds.includes(child.componentId)
          ? `${selectedDefinition.name} does not allow ${child.componentId} in ${slot.label}.`
          : !slot.multiple && existing.length
            ? `${slot.label} accepts one component.`
            : null;
      if (slotError) {
        setMessage(slotError);
        return;
      }
      const update = (
        instance: CmsComponentInstance,
      ): CmsComponentInstance => ({
        ...instance,
        slots: {
          ...instance.slots,
          [slotName]: [...(instance.slots?.[slotName] ?? []), child],
        },
      });
      const nextSlots = selectedInstance
        ? Object.fromEntries(
            Object.entries(selected.slots ?? {}).map(([slot, items]) => [
              slot,
              updateComponentInstances(items, selectedInstance.id, update) ??
                [],
            ]),
          )
        : {
            ...(selected.slots ?? {}),
            [slotName]: [...(selected.slots?.[slotName] ?? []), child],
          };
      commit(
        blocks.map((block) =>
          block.id === selected.id ? { ...block, slots: nextSlots } : block,
        ),
        undefined,
        {
          type: "insert",
          nodeId: child.id,
          parentId: selectedInstance?.id ?? selected.id,
          slot: slotName,
          index: existing.length,
        },
      );
      setMessage(`${definition.name} added to ${slotName}.`);
    },
    [
      blocks,
      commit,
      componentDefinitions,
      selected,
      selectedDefinition,
      selectedInstance,
    ],
  );
  useEffect(() => {
    addInstanceToSlotRef.current = addInstanceToSlot;
    return () => {
      if (addInstanceToSlotRef.current === addInstanceToSlot)
        addInstanceToSlotRef.current = null;
    };
  }, [addInstanceToSlot]);
  const onDropSlot = (
    event: DragEvent<HTMLDivElement>,
    slotName: string,
    dropIndex?: number,
  ) => {
    event.preventDefault();
    if (!selected) return;
    const targetOwnerId = selectedInstance?.id ?? selected.id;
    const encodedInstance = event.dataTransfer.getData(
      "application/x-cms-component-instance",
    );
    if (encodedInstance) {
      try {
        const payload = JSON.parse(encodedInstance) as {
          id?: string;
          blockId?: string;
          componentId?: string;
        };
        if (payload.id && payload.blockId) {
          const slot = selectedDefinition?.slots.find(
            (item) => item.name === slotName,
          );
          if (!slot) return;
          const moving = findCmsNode(blocks, payload.id);
          if (!moving || !("componentId" in moving) || !moving.componentId)
            return;
          const currentItems = selectedEditorBlock?.slots?.[slotName] ?? [];
          const movingWithinSameSlot =
            payload.blockId === selected.id &&
            currentItems.some((item) => item.id === payload.id);
          if (!slot.multiple && currentItems.length && !movingWithinSameSlot)
            return;
          const result = moveCmsInstance(
            blocks,
            payload.id,
            targetOwnerId,
            slotName,
            dropIndex ?? currentItems.length,
          );
          if (result.error) {
            setMessage(result.error);
            return;
          }
          if (result.blocks !== blocks) {
            commit(result.blocks, selected.id, {
              type: "move",
              nodeId: payload.id,
              parentId: targetOwnerId,
              slot: slotName,
              index: dropIndex ?? currentItems.length,
            });
            setMessage("Component moved into slot.");
          }
          return;
        }
      } catch {
        setMessage("Invalid component drag payload.");
        return;
      }
    }
    const componentId = event.dataTransfer.getData(
      "application/x-cms-component",
    );
    if (componentId) {
      if (!selectedDefinition) {
        setMessage("Select a component before dropping into a slot.");
        return;
      }
      const slot = selectedDefinition?.slots.find(
        (item) => item.name === slotName,
      );
      if (
        slot?.allowedComponentIds?.length &&
        !slot.allowedComponentIds.includes(componentId)
      ) {
        setMessage(
          `${selectedDefinition.name} does not allow ${componentId} in ${slot.label}.`,
        );
        return;
      }
      addInstanceToSlot(slotName, componentId);
    }
  };
  const updateSelectedSlot = (
    slotName: string,
    update: (_items: CmsComponentInstance[]) => CmsComponentInstance[],
    mutation?: CmsMutationShape,
  ) => {
    if (!selected) return;
    const updateOwner = (
      owner: CmsComponentInstance,
    ): CmsComponentInstance => ({
      ...owner,
      slots: {
        ...owner.slots,
        [slotName]: update(owner.slots?.[slotName] ?? []),
      },
    });
    const nextSlots = selectedInstance
      ? Object.fromEntries(
          Object.entries(selected.slots ?? {}).map(([slot, items]) => [
            slot,
            updateComponentInstances(items, selectedInstance.id, (instance) =>
              updateOwner(instance),
            ) ?? [],
          ]),
        )
      : {
          ...(selected.slots ?? {}),
          [slotName]: update(selected.slots?.[slotName] ?? []),
        };
    commit(
      blocks.map((block) =>
        block.id === selected.id ? { ...block, slots: nextSlots } : block,
      ),
      undefined,
      mutation,
    );
  };
  const removeInstanceFromSlot = (slotName: string, index: number) => {
    const child = (selectedEditorBlock?.slots?.[slotName] ?? [])[index];
    updateSelectedSlot(
      slotName,
      (items) => items.filter((_, itemIndex) => itemIndex !== index),
      child
        ? {
            type: "remove",
            nodeId: child.id,
            parentId: selectedInstance?.id ?? selected?.id,
            slot: slotName,
            index,
          }
        : undefined,
    );
    setMessage("Slot item removed.");
  };
  const moveInstanceInSlot = (
    slotName: string,
    index: number,
    delta: number,
  ) => {
    const child = (selectedEditorBlock?.slots?.[slotName] ?? [])[index];
    updateSelectedSlot(
      slotName,
      (items) => {
        const target = index + delta;
        if (index < 0 || target < 0 || target >= items.length) return items;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      },
      child
        ? {
            type: "move",
            nodeId: child.id,
            parentId: selectedInstance?.id ?? selected?.id,
            slot: slotName,
            index: index + delta,
          }
        : undefined,
    );
    setMessage("Slot order updated.");
  };
  const updateSelected = (props: Record<string, unknown>) => {
    if (!selected) return;
    if (selectedInstance) {
      const nextProps = instanceOverrides(
        selectedDefinition,
        selectedInstance.variantId,
        props,
      );
      const slots = Object.fromEntries(
        Object.entries(selected.slots ?? {}).map(([slot, items]) => [
          slot,
          updateComponentInstances(items, selectedInstance.id, (instance) => ({
            ...instance,
            props: nextProps,
          })) ?? [],
        ]),
      );
      commit(
        blocks.map((block) =>
          block.id === selected.id ? { ...block, slots } : block,
        ),
      );
      return;
    }
    commit(
      blocks.map((block) =>
        block.id === selected.id ? { ...block, props } : block,
      ),
    );
  };

  const pickMediaForSelected = useCallback((target: string) => {
    setMediaPickerTarget(target);
  }, []);

  const applyPickedMedia = useCallback(
    (media: PickedMedia[]) => {
      const picked = media[0];
      const block = selectedEditorBlock;
      if (!picked || !block || mediaPickerTarget === null) return;
      if (mediaPickerTarget.startsWith("tiles:")) {
        const index = Number(mediaPickerTarget.slice("tiles:".length));
        const tiles = Array.isArray(block.props.tiles)
          ? [...block.props.tiles]
          : [];
        const tile = tiles[index];
        if (tile && typeof tile === "object" && !Array.isArray(tile)) {
          const nextTile: Record<string, unknown> = {
            ...(tile as Record<string, unknown>),
            imageMediaId: picked.id,
          };
          delete nextTile.imageUrl;
          tiles[index] = nextTile;
          updateSelected({ ...block.props, tiles });
        }
      } else if (selectedVisualDefinition) {
        const sourceMarkup = text(
          block.props.markup,
          selectedVisualDefinition.markup,
        );
        updateSelected({
          ...block.props,
          [mediaPickerTarget]: picked.public_url,
          [`${mediaPickerTarget}MediaId`]: picked.id,
          markup: visualMarkupWithProperty(
            sourceMarkup,
            selectedVisualDefinition,
            mediaPickerTarget,
            picked.public_url,
          ),
        });
      } else {
        const nextProps = {
          ...block.props,
          [`${mediaPickerTarget.replace(/Url$/, "")}MediaId`]: picked.id,
        };
        delete nextProps[mediaPickerTarget];
        updateSelected(nextProps);
      }
      setMediaPickerTarget(null);
      setMessage("Media selected from the shared catalog library.");
    },
    [mediaPickerTarget, selectedEditorBlock, selectedVisualDefinition],
  );
  const updateSelectedVariant = (variantId: string) => {
    if (!selected) return;
    if (selectedInstance) {
      const slots = Object.fromEntries(
        Object.entries(selected.slots ?? {}).map(([slot, items]) => [
          slot,
          updateComponentInstances(items, selectedInstance.id, (instance) => ({
            ...instance,
            variantId,
          })) ?? [],
        ]),
      );
      commit(
        blocks.map((block) =>
          block.id === selected.id ? { ...block, slots } : block,
        ),
      );
    } else {
      commit(
        blocks.map((block) =>
          block.id === selected.id ? { ...block, variantId } : block,
        ),
      );
    }
    setMessage("Instance variant updated.");
  };
  const move = (delta: number) => {
    if (!selected) return;
    const index = blocks.findIndex((b) => b.id === selected.id);
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const removeSelected = () => {
    if (!selected || FIXED_COMPONENT_TYPES.has(selected.type)) return;
    const index = blocks.findIndex((b) => b.id === selected.id);
    const next = blocks.filter((b) => b.id !== selected.id);
    commit(next, next[Math.max(0, index - 1)]?.id);
  };
  const appendPreset = () => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset?.blocks.length) {
      setMessage("Choose a preset with blocks.");
      return;
    }
    const appended: CmsBlock[] = [];
    for (const block of preset.blocks) {
      if (FIXED_COMPONENT_TYPES.has(block.type)) continue;
      appended.push({ ...block, id: makeId(), props: { ...block.props } });
    }
    commit([...blocks, ...appended], appended[0]?.id);
  };
  const savePreset = async () => {
    if (!presetName.trim() || !blocks.length) {
      setMessage("Enter a name and add at least one block.");
      return;
    }
    const r = await fetch("/api/admin/cms/block-presets", {
      method: "POST",
      headers: cmsMutationHeaders(),
      body: JSON.stringify({
        name: presetName.trim(),
        blocks: blocks.filter(
          (block) => !FIXED_COMPONENT_TYPES.has(block.type),
        ),
      }),
    });
    if (r.ok) {
      setPresetName("");
      setMessage("Preset saved.");
    }
  };
  const addBlockAt = (type: string, index = blocks.length) => {
    if (FIXED_COMPONENT_TYPES.has(type)) return;
    const definition = componentDefinitions.find(
      (item) => item.id === type.replaceAll("_", "-"),
    );
    const block = {
      id: makeId(),
      type,
      componentId: definition?.id,
      variantId: definition?.defaultVariantId,
      props: {
        ...getCmsDefaultProps(type),
        ...(definition?.props ?? []).reduce<Record<string, unknown>>(
          (acc, item) => {
            if (item.defaultValue !== undefined)
              acc[item.key] = item.defaultValue;
            return acc;
          },
          {},
        ),
        ...(definition?.variants.find(
          (variant) => variant.id === definition.defaultVariantId,
        )?.props ?? {}),
      },
      slots: definition?.slots.length ? {} : undefined,
    } satisfies CmsBlock;
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    commit(next, block.id);
  };
  const onDropBlock = (
    event: DragEvent<HTMLElement>,
    index = blocks.length,
  ) => {
    event.preventDefault();
    const movingId = event.dataTransfer.getData("application/x-cms-block-id");
    if (movingId) {
      const from = blocks.findIndex((block) => block.id === movingId);
      if (
        from >= 0 &&
        from !== index &&
        !FIXED_COMPONENT_TYPES.has(blocks[from].type)
      ) {
        const next = [...blocks];
        const [moving] = next.splice(from, 1);
        next.splice(
          Math.max(0, Math.min(index > from ? index - 1 : index, next.length)),
          0,
          moving,
        );
        commit(next, moving.id, {
          type: "move",
          nodeId: moving.id,
          parentId: null,
          index: next.indexOf(moving),
        });
      }
      return;
    }
    const visualType = event.dataTransfer.getData(
      "application/x-uvs-component",
    );
    if (visualType.startsWith("visual:")) {
      const definition = UVS_DEFINITIONS.find(
        (item) => item.type === visualType.slice("visual:".length),
      );
      if (!definition) return;
      const block: CmsBlock = {
        id: makeId(),
        type: "visual_primitive",
        componentId: `visual:${definition.type}`,
        props: {
          sourceType: definition.type,
          sourceName: definition.name,
          markup: definition.markup,
          ...visualInitialProps(definition),
        },
      };
      const next = [...blocks];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
      commit(next, block.id);
      return;
    }
    const componentType = event.dataTransfer.getData(
      "application/x-cms-component",
    );
    if (componentType) {
      addBlockAt(componentType.replaceAll("-", "_"), index);
      return;
    }
    const type = event.dataTransfer.getData("application/x-cms-block");
    if (type) addBlockAt(type, index);
  };
  const toggleFullscreen = async () => {
    if (!surfaceRef.current) return;
    if (!document.fullscreenElement) {
      await surfaceRef.current.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F11") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        const result = undoCmsCommand(history, blocks);
        if (result.state === blocks) return;
        event.preventDefault();
        setHistory(result.history);
        onChange(result.state);
        const mutation = persistedCmsMutation(blocks, result.state);
        if (mutation) onMutation?.(mutation);
      } else if (key === "y" && event.shiftKey) {
        const result = redoCmsCommand(history, blocks);
        if (result.state === blocks) return;
        event.preventDefault();
        setHistory(result.history);
        onChange(result.state);
        const mutation = persistedCmsMutation(blocks, result.state);
        if (mutation) onMutation?.(mutation);
      } else if (key === "l" && event.shiftKey) {
        event.preventDefault();
        setLeftOpen(true);
        setLeftTab("layers");
      } else if (key === "e" && !event.shiftKey) {
        event.preventDefault();
        setRightOpen(true);
        setRightTab("code");
      } else if (key === "p" && event.shiftKey) {
        event.preventDefault();
        onNewPage?.();
      } else if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        onSave?.(blocks);
      } else if (key === "s" && event.shiftKey) {
        event.preventDefault();
        setLeftOpen(true);
        setLeftTab("sections");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [blocks, history, onChange, onMutation, onNewPage, onSave]);
  const canvasWidth =
    device === "desktop"
      ? "min(100%, 1400px)"
      : device === "laptop"
        ? "1200px"
        : device === "tablet-landscape"
          ? "992px"
          : device === "tablet"
            ? "768px"
            : device === "mobile"
              ? "576px"
              : "100%";

  const navigatorPanel = (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Navigator
        </p>
        <button
          type="button"
          onClick={() => setNavigatorOpen(false)}
          className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close Navigator"
          title="Close Navigator"
        >
          <X className="size-3" />
        </button>
      </div>
      <ComponentTree
        nodes={componentTree}
        selectedId={selectedComponentId}
        expandedIds={expandedNodeIds}
        onToggle={(id) =>
          setExpandedNodeIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onSelect={(node) => {
          setSelectedId(node.blockId);
          setSelectedComponentId(node.id);
          setRightTab("content");
          setRightOpen(true);
        }}
      />
    </div>
  );

  const surface = (
    <section
      ref={surfaceRef}
      className={`${immersive && !fullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "relative min-h-[760px] rounded-xl"} relative flex flex-col overflow-hidden border border-slate-200 bg-slate-100 text-slate-700 shadow-2xl`}
      aria-label="Visual page builder"
    >
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white pl-12 pr-2 text-slate-500">
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100"
          onClick={() => {
            setLeftOpen(true);
            setLeftTab("files");
          }}
          aria-label="Toggle file manager"
          aria-pressed={leftOpen && leftTab === "files"}
          title="Toggle file manager"
        >
          <VvvebIcon name="file-manager-layout" />
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100"
          onClick={() => setLeftOpen((v) => !v)}
          aria-label="Toggle left column"
          aria-pressed={leftOpen}
          title="Toggle left column"
        >
          <VvvebIcon name="left-column-layout" />
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100"
          onClick={() => setRightOpen((v) => !v)}
          aria-label="Toggle right column"
          aria-pressed={rightOpen}
          title="Toggle right column"
        >
          <VvvebIcon name="right-column-layout" />
        </button>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100 disabled:opacity-30"
          onClick={() => {
            const result = undoCmsCommand(history, blocks);
            if (result.state !== blocks) {
              setHistory(result.history);
              onChange(result.state);
              const mutation = persistedCmsMutation(blocks, result.state);
              if (mutation) onMutation?.(mutation);
            }
          }}
          disabled={disabled || !history.past.length}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd + Z)"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100 disabled:opacity-30"
          onClick={() => {
            const result = redoCmsCommand(history, blocks);
            if (result.state !== blocks) {
              setHistory(result.history);
              onChange(result.state);
              const mutation = persistedCmsMutation(blocks, result.state);
              if (mutation) onMutation?.(mutation);
            }
          }}
          disabled={disabled || !history.future.length}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd + Shift + Y)"
        >
          <Redo2 className="size-4" />
        </button>
        {currentPageId ? (
          <div className="relative">
            <button
              type="button"
              className="grid size-8 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setRevisionsOpen((open) => !open)}
              aria-expanded={revisionsOpen}
              aria-label="Revisions"
              title="Revisions"
            >
              <span className="relative">
                <History className="size-3.5" />
                <span className="absolute -right-2 -top-2 text-[8px] font-semibold leading-none text-slate-400">
                  {revisions.length}
                </span>
              </span>
            </button>
            {revisionsOpen ? (
              <div className="absolute left-0 top-9 z-40 w-72 rounded border border-slate-200 bg-white p-2 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Revisions
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {revisions.length}
                  </span>
                </div>
                {revisionsLoading ? (
                  <p className="px-2 py-3 text-xs text-slate-500">
                    Loading revisions...
                  </p>
                ) : null}
                {!revisionsLoading && !revisions.length ? (
                  <p className="px-2 py-3 text-xs text-slate-500">
                    No saved revisions.
                  </p>
                ) : null}
                {!revisionsLoading && revisions.length ? (
                  <div className="max-h-64 overflow-y-auto py-1">
                    {revisions.map((revision) => (
                      <button
                        key={revision.id}
                        type="button"
                        onClick={() => restoreRevision(revision.revision)}
                        className="flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-xs hover:bg-slate-50"
                      >
                        <span className="text-slate-700">
                          Revision {revision.revision}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(revision.created_at).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="ml-2 hidden min-w-0 items-center gap-2 text-xs font-medium text-slate-700 sm:flex">
          <span className="grid size-6 place-items-center rounded bg-slate-100">
            <VvvebIcon name="icon-list" className="size-3.5" />
          </span>
          <span className="max-w-48 truncate">
            {pageTitle || "Page editor"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1 border-l border-slate-200 pl-2">
          <div className="relative">
            <button
              type="button"
              className={`grid size-8 place-items-center rounded hover:bg-slate-100 ${breakpointsOpen || device ? "bg-slate-100 text-slate-900" : ""}`}
              onClick={() => setBreakpointsOpen((open) => !open)}
              aria-expanded={breakpointsOpen}
              aria-label="Breakpoints"
              title="Breakpoints"
            >
              <Smartphone className="size-3.5" />
            </button>
            {breakpointsOpen ? (
              <div className="absolute right-0 top-9 z-50 w-44 rounded border border-slate-200 bg-white p-1 shadow-xl">
                {(
                  [
                    ["mobile", Smartphone, "Mobile view"],
                    ["tablet", Tablet, "Tablet view"],
                    ["tablet-landscape", Tablet, "Tablet landscape view"],
                    ["laptop", Laptop, "Laptop view"],
                    ["desktop", Monitor, "Desktop view"],
                  ] as const
                ).map(([name, Icon, label]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setDevice((current) => (current === name ? null : name));
                      setBreakpointsOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-100 ${device === name ? "bg-slate-100 text-slate-900" : "text-slate-600"}`}
                    aria-label={label}
                  >
                    <Icon
                      className={`size-3.5 ${name === "tablet" ? "rotate-90" : ""}`}
                    />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-slate-100"
            onClick={() => setZoom((v) => Math.max(10, v - 10))}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="w-9 text-center text-[10px] tabular-nums">
            {zoom}%
          </span>
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-slate-100"
            onClick={() => setZoom((v) => Math.min(100, v + 10))}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </button>
          {previewUrl ? (
            <button
              type="button"
              className="ml-1 grid size-8 place-items-center rounded hover:bg-slate-100"
              onClick={() => {
                const safePreviewUrl = sanitizeTrustedPublicUrl(previewUrl);
                if (safePreviewUrl)
                  window.open(safePreviewUrl, "_blank", "noopener,noreferrer");
              }}
              aria-label="Preview"
              title="Preview"
            >
              <Eye className="size-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-slate-100"
            onClick={() => void toggleFullscreen()}
            aria-label="Fullscreen"
            title="Fullscreen (F11)"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            className={`grid size-8 place-items-center rounded hover:bg-slate-100 ${showHidden ? "bg-slate-100 text-slate-900" : ""}`}
            onClick={() => setShowHidden((current) => !current)}
            aria-pressed={showHidden}
            aria-label="Show hidden elements"
            title="Show hidden elements"
          >
            <Eye className="size-3.5" />
          </button>
          <button
            type="button"
            className={`grid size-8 place-items-center rounded hover:bg-slate-100 ${styleTheme ? "bg-slate-100 text-slate-900" : ""}`}
            onClick={() =>
              setStyleTheme((current) =>
                current === "dark" ? "light" : "dark",
              )
            }
            aria-label="Toggle color theme"
            aria-pressed={styleTheme === "dark"}
            title="Toggle color theme"
          >
            <SunMoon className="size-3.5" />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-slate-100"
            onClick={() => {
              setLeftOpen(true);
              setNavigatorOpen((open) => !open);
            }}
            aria-label="Toggle navigator"
            aria-pressed={leftOpen && navigatorOpen}
            title="Toggle navigator (Ctrl + Shift + L)"
          >
            <VvvebIcon name="icon-list" className="size-3.5" />
          </button>
          {!toolbarActions && onSave ? (
            <button
              type="button"
              className="grid size-8 place-items-center rounded hover:bg-slate-100"
              onClick={() => {
                onSave(blocks);
              }}
              aria-label="Save"
              title="Save (Ctrl/Cmd + S)"
            >
              <Save className="size-3.5" />
            </button>
          ) : null}
          {toolbarActions}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 pl-10">
        <nav className="absolute bottom-0 left-0 top-0 z-40 flex w-10 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3">
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded hover:bg-slate-100"
            aria-label="Vvveb"
            title="Vvveb"
          >
            <span
              aria-hidden="true"
              className="text-[10px] font-semibold leading-none tracking-[-0.12em] text-lime-500"
            >
              \vvveb
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLeftOpen((open) => !open)}
            className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100"
            aria-label="Toggle navigation"
            title="Toggle navigation"
          >
            <Menu className="size-3.5" />
          </button>
          <span className="my-1 h-px w-5 bg-slate-200" />
          {(
            [
              ["Pages", FileText],
              ["Components", Box],
              ["Sections", Layers],
              ["Style", Paintbrush],
              ["Ai Assistant", Sparkles],
            ] as const
          ).map(([label, Icon]) => (
            <button
              key={label}
              type="button"
              className={`grid size-8 place-items-center rounded hover:bg-slate-100 ${
                (
                  label === "Style"
                    ? leftOpen && leftTab === "configuration"
                    : leftOpen &&
                      ((label === "Pages" && leftTab === "pages") ||
                        (label === "Components" && leftTab === "components") ||
                        (label === "Sections" && leftTab === "sections") ||
                        (label === "Ai Assistant" && leftTab === "ai"))
                )
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400"
              }`}
              onClick={() => {
                if (label === "Style") {
                  setLeftOpen(true);
                  setLeftTab("configuration");
                  return;
                }
                if (label === "Ai Assistant") {
                  setLeftOpen(true);
                  setLeftTab("ai");
                  return;
                }
                setLeftOpen(true);
                setLeftTab(
                  label === "Pages"
                    ? "pages"
                    : label === "Components"
                      ? "components"
                      : "sections",
                );
              }}
              aria-label={label}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </nav>
        {leftOpen ? (
          <aside className="z-30 flex w-[290px] min-h-0 shrink-0 flex-col border-r border-slate-200 bg-white max-sm:absolute max-sm:left-10 max-sm:top-11 max-sm:bottom-0 max-sm:w-[min(290px,calc(100vw-40px))] max-sm:shadow-xl">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
              {leftTab === "pages" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <input
                    type="search"
                    value={pageQuery}
                    onChange={(event) => setPageQuery(event.target.value)}
                    placeholder="Pages"
                    aria-label="Pages"
                    className="mb-3 h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
                  />
                  <div className="mb-3 flex items-center justify-between">
                    <span />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={onNewPage}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                        aria-label="Add page"
                        title="New page (Ctrl + Shift + P)"
                      >
                        Add page <Plus className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLeftTab("sections");
                          setPaletteTab("sections");
                        }}
                        className="grid size-7 place-items-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                        aria-label="Add section"
                        title="New section (Ctrl + Shift + S)"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {pages
                      .flatMap((page) =>
                        `${page.title} ${page.slug}`
                          .toLowerCase()
                          .includes(pageQuery.trim().toLowerCase())
                          ? [page]
                          : [],
                      )
                      .map((page) => (
                        <div
                          key={page.id}
                          className={`flex w-full items-center gap-1 rounded px-1.5 py-1.5 text-left text-xs ${page.id === currentPageId ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectPage?.(page.id)}
                            aria-pressed={page.id === currentPageId}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left hover:bg-slate-50 hover:text-slate-900"
                          >
                            <VvvebIcon
                              name="file"
                              className="size-3 shrink-0"
                            />
                            <span className="min-w-0 truncate">
                              {page.title || page.slug}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {onDeletePage ? (
                              <button
                                type="button"
                                onClick={() => onDeletePage(page.id)}
                                aria-label={`Delete ${page.title || page.slug}`}
                                title="Delete page"
                                className="grid size-6 place-items-center rounded text-slate-400 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            ) : null}
                            {onPreviewPage ? (
                              <button
                                type="button"
                                onClick={() => onPreviewPage(page.id)}
                                aria-label={`Preview ${page.title || page.slug}`}
                                title="Preview page"
                                className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              >
                                <Eye className="size-3" />
                              </button>
                            ) : null}
                            {onDuplicatePage ? (
                              <button
                                type="button"
                                onClick={() => onDuplicatePage(page.id)}
                                aria-label={`Duplicate ${page.title || page.slug}`}
                                title="Duplicate page"
                                className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              >
                                <Copy className="size-3" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                  </div>
                  {navigatorOpen ? navigatorPanel : null}
                </div>
              ) : null}
              {leftTab === "layers" ? navigatorPanel : null}
              {leftTab === "files" ? (
                <div className="-m-3 min-h-full">
                  <CmsMediaManager />
                </div>
              ) : null}
              {leftTab === "configuration" ? (
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-1 border-b border-slate-200 pb-2"
                    role="tablist"
                    aria-label="Style panels"
                  >
                    {(["styles", "variables"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setConfigurationTab(tab)}
                        role="tab"
                        aria-selected={configurationTab === tab}
                        className={`rounded px-2 py-1 text-[11px] capitalize ${configurationTab === tab ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
                      >
                        <span className="mr-1 text-slate-400">
                          {tab === "styles" ? "▤" : "♢"}
                        </span>{" "}
                        {tab === "styles" ? "Styles" : "Variables"}
                      </button>
                    ))}
                  </div>
                  {configurationTab === "styles" ? (
                    <div
                      role="tabpanel"
                      aria-label="Styles"
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
                        <button
                          type="button"
                          aria-label="Collapse Base styles"
                          aria-expanded={stylesBaseOpen}
                          onClick={() => setStylesBaseOpen((open) => !open)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          type="search"
                          value={configurationQuery}
                          onChange={(event) =>
                            setConfigurationQuery(event.target.value)
                          }
                          placeholder="Search styles"
                          aria-label="Search styles"
                          className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
                        />
                        <button
                          type="button"
                          aria-label="Clear style search"
                          disabled={!configurationQuery}
                          onClick={() => setConfigurationQuery("")}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <div className="rounded border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setStylesBaseOpen((open) => !open)}
                          className="flex w-full items-center justify-between px-2.5 py-2 text-left text-[11px] font-medium text-slate-700"
                        >
                          <span>Base</span>
                          <ChevronDown
                            className={`size-3.5 transition-transform ${stylesBaseOpen ? "" : "-rotate-90"}`}
                          />
                        </button>
                        {stylesBaseOpen ? (
                          <div className="border-t border-slate-200 px-2.5 py-2 text-[11px] text-slate-400">
                            No registered styles.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div
                      role="tabpanel"
                      aria-label="Variables"
                      className="space-y-2"
                    >
                      <input
                        type="search"
                        value={configurationQuery}
                        onChange={(event) =>
                          setConfigurationQuery(event.target.value)
                        }
                        placeholder="Search variables"
                        aria-label="Search variables"
                        className="h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
                      />
                      {(["font", "color", "dimensions"] as const).map(
                        (type: PaletteVariableType) => {
                          const variables = Object.entries(
                            cssVariables[type],
                          ).filter(([name, variable]) =>
                            `${name} ${variable.friendlyName} ${variable.value}`
                              .toLowerCase()
                              .includes(
                                configurationQuery.trim().toLowerCase(),
                              ),
                          );
                          if (!variables.length) return null;
                          return (
                            <details
                              key={type}
                              className="rounded border border-slate-200"
                              open
                            >
                              <summary className="cursor-pointer px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {type}
                              </summary>
                              <div className="space-y-1 border-t border-slate-200 p-2">
                                {variables.map(([name, variable]) => (
                                  <div
                                    key={name}
                                    className="rounded bg-slate-50 px-2 py-1.5"
                                  >
                                    <p className="truncate text-[11px] font-medium text-slate-700">
                                      {variable.friendlyName}
                                    </p>
                                    <p
                                      className="truncate font-mono text-[10px] text-slate-400"
                                      title={name}
                                    >
                                      {variable.value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              ) : null}
              {leftTab === "ai" ? (
                <section aria-label="Ai Assistant" className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setAssistantSessionsOpen((open) => !open)
                        }
                        aria-expanded={assistantSessionsOpen}
                        aria-label="Sessions"
                        title="Sessions"
                        className={`grid size-7 place-items-center rounded hover:bg-slate-100 ${assistantSessionsOpen ? "bg-slate-100 text-slate-900" : ""}`}
                      >
                        <Sparkles className="size-3.5 text-slate-500" />
                      </button>
                      {assistantSessionsOpen ? (
                        <div
                          role="list"
                          className="absolute left-0 top-8 z-40 w-48 rounded border border-slate-200 bg-white p-2 shadow-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setAssistantPrompt("");
                              setAssistantAttachment(null);
                              setAssistantSessionsOpen(false);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-50"
                          >
                            New session
                          </button>
                          <div className="my-1 border-t border-slate-100" />
                          <p className="px-2 py-1 text-[10px] text-slate-400">
                            No previous sessions
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">
                      AI assistant
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssistantOptionsOpen((open) => !open)}
                      aria-expanded={assistantOptionsOpen}
                      className={`grid size-7 place-items-center rounded hover:bg-slate-100 ${assistantOptionsOpen ? "bg-slate-100 text-slate-900" : ""}`}
                      aria-label="Assistant options"
                      title="Options"
                    >
                      <Settings2 className="size-3.5 text-slate-500" />
                    </button>
                  </div>
                  {assistantOptionsOpen ? (
                    <div
                      role="list"
                      aria-label="Assistant options"
                      className="space-y-1 rounded border border-slate-200 bg-white p-2 shadow-sm"
                    >
                      {[
                        [
                          "Show thinking",
                          assistantShowThinking,
                          setAssistantShowThinking,
                          "Thinking",
                        ],
                        [
                          "Show tool calls",
                          assistantShowToolCalls,
                          setAssistantShowToolCalls,
                          "Tool calls",
                        ],
                        [
                          "Allow screenshots",
                          assistantAllowScreenshots,
                          setAssistantAllowScreenshots,
                          "Screenshots",
                        ],
                      ].map(([label, checked, setChecked, detail]) => (
                        <div
                          key={label as string}
                          className="flex items-center justify-between gap-3 px-1 py-1 text-[11px] text-slate-600"
                        >
                          <span>{detail as string}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-label={label as string}
                            aria-checked={checked as boolean}
                            onClick={() =>
                              (
                                setChecked as (
                                  _value: (_current: boolean) => boolean,
                                ) => void
                              )((current) => !current)
                            }
                            className={`relative h-5 w-9 rounded-full ${checked ? "bg-slate-900" : "bg-slate-200"}`}
                          >
                            <span
                              className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${checked ? "left-4" : "left-0.5"}`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600">
                    <span>Context</span>
                    <button
                      type="button"
                      onClick={() => setAssistantContextOpen((open) => !open)}
                      aria-expanded={assistantContextOpen}
                      aria-label="Context"
                      className="rounded px-1.5 py-0.5 hover:bg-slate-100"
                    >
                      ⌄
                    </button>
                  </div>
                  {assistantContextOpen ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] leading-4 text-slate-500">
                      Selected page and element context
                    </div>
                  ) : null}
                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <h2 className="text-sm font-medium text-slate-800">
                      Ask me to build or edit this page
                    </h2>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      I can see what&apos;s selected, attach a reference image,
                      or talk through it by voice.
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    {[
                      "Convert attached image to design",
                      "Improve page aesthetics",
                      "Add new page",
                      "Add a hero section",
                      "Change button color",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          if (prompt === "Add new page") onNewPage?.();
                          else if (prompt === "Add a hero section")
                            addBlock("hero");
                          else setAssistantPrompt(prompt);
                        }}
                        className="rounded border border-slate-200 px-2.5 py-2 text-left text-[11px] text-slate-600 hover:bg-slate-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={assistantPrompt}
                    onChange={(event) => setAssistantPrompt(event.target.value)}
                    placeholder="Describe what to build or change…"
                    aria-label="Describe what to build or change…"
                    className="min-h-24 w-full resize-y rounded border border-slate-200 bg-white p-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => assistantFileInputRef.current?.click()}
                      className="grid size-8 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Attach file"
                      title="Attach file"
                    >
                      <Paperclip className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssistantOptionsOpen((open) => !open)}
                      aria-expanded={assistantOptionsOpen}
                      className="grid size-8 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Assistant tools"
                      title="Assistant tools"
                    >
                      <Settings2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => assistantFileInputRef.current?.click()}
                      className="h-8 rounded border border-slate-200 px-2 text-[10px] text-slate-600 hover:bg-slate-50"
                    >
                      Choose File
                    </button>
                    <button
                      type="button"
                      aria-pressed={voiceListening}
                      onClick={() => {
                        if (voiceListening) return;
                        const speechWindow = window as Window & {
                          SpeechRecognition?: BrowserSpeechRecognitionConstructor;
                          webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
                        };
                        const Recognition =
                          speechWindow.SpeechRecognition ??
                          speechWindow.webkitSpeechRecognition;
                        if (!Recognition) {
                          setMessage(
                            "Voice input is not supported by this browser.",
                          );
                          return;
                        }
                        const recognition = new Recognition();
                        recognition.lang = "en-US";
                        recognition.interimResults = false;
                        recognition.onresult = (event) => {
                          const transcript =
                            event.results[0]?.[0]?.transcript?.trim();
                          if (transcript)
                            setAssistantPrompt(
                              (current) =>
                                `${current}${current ? " " : ""}${transcript}`,
                            );
                        };
                        recognition.onerror = () => {
                          setVoiceListening(false);
                          setMessage("Voice input could not be started.");
                        };
                        recognition.onend = () => setVoiceListening(false);
                        setVoiceListening(true);
                        recognition.start();
                      }}
                      className={`grid size-8 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 ${voiceListening ? "bg-slate-100 text-slate-900" : ""}`}
                      aria-label="Voice input"
                      title="Voice input"
                    >
                      <Mic className="size-3.5" />
                    </button>
                    <input
                      ref={assistantFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      tabIndex={-1}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setAssistantAttachment(file.name);
                        setAssistantPrompt("Convert attached image to design");
                      }}
                    />
                  </div>
                  {assistantAttachment ? (
                    <p
                      className="truncate text-[10px] text-slate-500"
                      title={assistantAttachment}
                    >
                      Attached: {assistantAttachment}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!assistantPrompt.trim()}
                    onClick={() => {
                      setMessage(
                        "AI assistant is not configured for this workspace.",
                      );
                      setAssistantPrompt("");
                    }}
                    title="Send"
                    className="h-8 w-full rounded bg-slate-900 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send message
                  </button>
                  <p className="text-center text-[10px] text-slate-400">
                    Enter to send · Shift+Enter for newline
                  </p>
                  <button
                    type="button"
                    onClick={() => setAssistantUsageOpen((open) => !open)}
                    aria-expanded={assistantUsageOpen}
                    aria-label="Toggle usage details"
                    title="Show usage details"
                    className="mx-auto block text-[10px] text-slate-400 hover:text-slate-700"
                  >
                    Toggle usage details
                  </button>
                  {assistantUsageOpen ? (
                    <p className="text-center text-[10px] text-slate-400">
                      No usage recorded in this session.
                    </p>
                  ) : null}
                </section>
              ) : null}
              {leftTab === "components" || leftTab === "sections" ? (
                <>
                  {leftTab === "components" ? (
                    <div
                      role="tablist"
                      aria-label="Component palette"
                      className="mb-3 flex items-center gap-1 border-b border-slate-200 pb-2"
                    >
                      {(
                        [
                          ["components", "Components"],
                          ["sections", "Blocks"],
                        ] as const
                      ).map(([tab, label]) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setPaletteTab(tab)}
                          role="tab"
                          aria-selected={paletteTab === tab}
                          className={`rounded px-2 py-1 text-[11px] capitalize ${paletteTab === tab ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      role="tablist"
                      aria-label="Section palette"
                      className="mb-3 flex items-center gap-1 border-b border-slate-200 pb-2"
                    >
                      {(
                        [
                          ["sections", "Sections"],
                          ["page-sections", "Page Sections"],
                        ] as const
                      ).map(([tab, label]) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSectionPaletteTab(tab)}
                          role="tab"
                          aria-selected={sectionPaletteTab === tab}
                          className={`rounded px-2 py-1 text-[11px] ${sectionPaletteTab === tab ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {leftTab !== "sections" ||
                  sectionPaletteTab === "sections" ? (
                    <div className="mb-3 flex items-center gap-1">
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100"
                        aria-label={
                          leftTab === "sections"
                            ? "Collapse section palette"
                            : "Collapse component palette"
                        }
                        title={
                          leftTab === "sections"
                            ? "Collapse section palette"
                            : "Collapse component palette"
                        }
                        onClick={() => setLeftOpen(false)}
                      >
                        <Minus className="size-3" />
                      </button>
                      <input
                        type="search"
                        value={paletteQuery}
                        onChange={(event) =>
                          setPaletteQuery(event.target.value)
                        }
                        placeholder={
                          leftTab === "sections"
                            ? sectionPaletteTab === "page-sections"
                              ? "Search page sections"
                              : "Search sections"
                            : paletteTab === "sections"
                              ? "Search blocks"
                              : "Search components"
                        }
                        aria-label={
                          leftTab === "sections"
                            ? sectionPaletteTab === "page-sections"
                              ? "Search page sections"
                              : "Search sections"
                            : paletteTab === "sections"
                              ? "Search blocks"
                              : "Search components"
                        }
                        className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
                      />
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100"
                        aria-label="Clear palette search"
                        title="Clear search"
                        onClick={() => setPaletteQuery("")}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : null}
                  {leftTab === "components" && paletteTab === "components" ? (
                    <div className="space-y-5">
                      {paletteGroups.map((group) => {
                        const definitions = groupedDefinitions[group] ?? [];
                        const sourceDefinitions =
                          groupedSourceDefinitions[group] ?? [];
                        return (
                          <div key={group}>
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedPaletteGroups((current) => {
                                  const next = new Set(current);
                                  if (next.has(group)) next.delete(group);
                                  else next.add(group);
                                  return next;
                                })
                              }
                              className="mb-2 flex w-full items-center justify-between text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                              aria-expanded={!collapsedPaletteGroups.has(group)}
                              aria-label={`${collapsedPaletteGroups.has(group) ? "Expand" : "Collapse"} ${group}`}
                            >
                              <span>{group}</span>
                              {collapsedPaletteGroups.has(group) ? (
                                <ChevronRight className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                            </button>
                            {!collapsedPaletteGroups.has(group) ? (
                              <div className="space-y-1.5">
                                {definitions
                                  .flatMap((definition) =>
                                    `${definition.name} ${definition.category}`
                                      .toLowerCase()
                                      .includes(
                                        paletteQuery.trim().toLowerCase(),
                                      )
                                      ? [definition]
                                      : [],
                                  )
                                  .map((definition) => (
                                    <div
                                      key={definition.id}
                                      className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1.5"
                                    >
                                      <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        data-testid={`cms-component-drag-${definition.id}`}
                                        draggable={!disabled}
                                        onDragStart={(event) => {
                                          event.dataTransfer.setData(
                                            "application/x-cms-component",
                                            definition.id,
                                          );
                                          event.dataTransfer.setData(
                                            "application/x-cms-component-id",
                                            definition.id,
                                          );
                                          event.dataTransfer.setData(
                                            "application/x-uvs-component",
                                            definition.id,
                                          );
                                        }}
                                        onClick={() =>
                                          setMessage(
                                            `${definition.name} is ready to drag into the page.`,
                                          )
                                        }
                                      >
                                        <span className="block truncate text-[11px] font-medium text-slate-700">
                                          {definition.name}
                                        </span>
                                        <span className="block truncate text-[10px] text-slate-400">
                                          {definition.category} ·{" "}
                                          {definition.variants.length} variants
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={disabled}
                                        className="grid size-6 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                                        onClick={() =>
                                          addBlock(
                                            definition.id.replaceAll("-", "_"),
                                          )
                                        }
                                        aria-label={`Add ${definition.name}`}
                                      >
                                        <Plus className="size-3" />
                                      </button>
                                    </div>
                                  ))}
                                {sourceDefinitions.map((definition) => (
                                  <div
                                    key={definition.type}
                                    className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1.5"
                                  >
                                    <button
                                      type="button"
                                      className="min-w-0 flex-1 text-left"
                                      data-testid={`cms-visual-component-drag-${definition.type}`}
                                      draggable={!disabled}
                                      onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                          "application/x-uvs-component",
                                          `visual:${definition.type}`,
                                        );
                                      }}
                                      onClick={() =>
                                        setMessage(
                                          `${definition.name ?? definition.type} is ready to add.`,
                                        )
                                      }
                                    >
                                      <Image
                                        src={visualIconPath(definition)}
                                        alt=""
                                        aria-hidden="true"
                                        width={28}
                                        height={28}
                                        className="mr-2 size-7 shrink-0 object-contain"
                                      />
                                      <span className="block truncate text-[11px] font-medium text-slate-700">
                                        {definition.name ?? definition.type}
                                      </span>
                                      <span className="block truncate text-[10px] text-slate-400">
                                        {definition.type}
                                      </span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {Object.entries(grouped).map(([group, items]) =>
                    (paletteTab === "sections") !==
                    (group === "Bootstrap 5") ? null : (
                      <div key={group} className="mb-5">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedPaletteGroups((current) => {
                              const next = new Set(current);
                              if (next.has(group)) next.delete(group);
                              else next.add(group);
                              return next;
                            })
                          }
                          className="mb-2 flex w-full items-center justify-between text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                          aria-expanded={!collapsedPaletteGroups.has(group)}
                          aria-label={`${collapsedPaletteGroups.has(group) ? "Expand" : "Collapse"} ${group}`}
                        >
                          <span>{group}</span>
                          {collapsedPaletteGroups.has(group) ? (
                            <ChevronRight className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )}
                        </button>
                        {!collapsedPaletteGroups.has(group) ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {items
                              .flatMap((item) =>
                                !FIXED_COMPONENT_TYPES.has(item.type) &&
                                `${item.label} ${group}`
                                  .toLowerCase()
                                  .includes(paletteQuery.trim().toLowerCase())
                                  ? [item]
                                  : [],
                              )
                              .map((item) => (
                                <button
                                  key={item.type}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => addBlock(item.type)}
                                  draggable={!disabled}
                                  onDragStart={(event) => {
                                    event.dataTransfer.setData(
                                      "application/x-cms-block",
                                      item.type,
                                    );
                                    event.dataTransfer.setData(
                                      "application/x-uvs-component",
                                      item.type,
                                    );
                                  }}
                                  className="rounded border border-slate-200 bg-white px-2 py-2.5 text-left text-[11px] text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
                                >
                                  <Plus className="mb-1 size-3 text-slate-400" />
                                  {item.label}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ),
                  )}
                </>
              ) : null}
              {leftTab === "sections" &&
              sectionPaletteTab === "page-sections" ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ComponentTree
                    nodes={componentTree}
                    selectedId={selectedComponentId}
                    expandedIds={expandedNodeIds}
                    onToggle={(id) =>
                      setExpandedNodeIds((current) => {
                        const next = new Set(current);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    onSelect={(node) => {
                      setSelectedId(node.blockId);
                      setSelectedComponentId(node.id);
                      setRightTab("content");
                      setRightOpen(true);
                    }}
                  />
                </div>
              ) : null}
              {(leftTab === "components" || leftTab === "sections") &&
              (leftTab === "components"
                ? paletteTab === "sections"
                : sectionPaletteTab === "sections") ? (
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Reusable
                  </p>
                  <label
                    htmlFor="cms-reusable-section-preset"
                    className="sr-only"
                  >
                    Reusable section preset
                  </label>
                  <select
                    id="cms-reusable-section-preset"
                    aria-label="Reusable section preset"
                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-600"
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value)}
                  >
                    <option value="">Select reusable section</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="mt-2 h-8 w-full rounded border border-slate-200 text-xs hover:bg-slate-50"
                    onClick={appendPreset}
                    disabled={disabled || !presetId}
                  >
                    Add reusable section
                  </button>
                  <input
                    aria-label="New reusable section name"
                    className="mt-3 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="New reusable section name"
                  />
                  <button
                    type="button"
                    className="mt-2 h-8 w-full rounded bg-primary text-xs font-medium text-primary-foreground"
                    onClick={() => void savePreset()}
                    disabled={disabled}
                  >
                    Save reusable section
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
        <main
          ref={canvasScrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-slate-200/90 p-3 sm:p-8"
        >
          {activeTool ? (
            <div className="mx-auto w-full max-w-6xl">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    CMS workspace
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    Content tool
                  </p>
                </div>
                <button
                  type="button"
                  className="h-8 rounded border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setActiveTool(null)}
                >
                  Back to canvas
                </button>
              </div>
              <CmsToolSurface tool={activeTool} />
            </div>
          ) : null}
          {!activeTool && builderMode === "canvas" ? (
            canvasDefinition ? (
              <div className="mx-auto max-w-5xl space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Main component
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">
                        {canvasDefinition.name}
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                        {canvasDefinition.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="h-8 rounded border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() => setBuilderMode("instance")}
                    >
                      Back to page
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Structure
                      </p>
                      <code className="mt-2 block rounded bg-slate-900 px-3 py-3 text-xs text-slate-100">
                        {canvasDefinition.structure}
                      </code>
                      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Semantic custom properties
                      </p>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600">
                        {Object.entries(canvasDefinition.styleTokens).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between gap-3"
                            >
                              <span>--cms-{key}</span>
                              <code className="text-slate-400">{value}</code>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Props and slots
                      </p>
                      <div className="mt-2 space-y-2">
                        {canvasDefinition.props.map((item) => (
                          <div
                            key={item.key}
                            className="rounded border border-slate-100 px-2.5 py-2"
                          >
                            <div className="text-xs font-medium text-slate-700">
                              {item.label}
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {item.key} · {item.type}
                            </div>
                            <input
                              className="mt-2 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                              value={String(
                                (canvasDraftDefinition?.variants.find(
                                  (variant) => variant.id === canvasVariantId,
                                )?.props ?? {})[item.key] ??
                                  item.defaultValue ??
                                  "",
                              )}
                              onChange={(event) =>
                                updateCanvasVisualProp(
                                  item.key,
                                  event.target.value,
                                )
                              }
                              disabled={disabled}
                              aria-label={item.label}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] text-slate-500">
                          Style tokens
                        </p>
                        {Object.entries(
                          canvasDraftDefinition?.styleTokens ??
                            canvasDefinition.styleTokens,
                        ).map(([key, value]) => (
                          <label
                            key={key}
                            className="block text-[10px] text-slate-500"
                          >
                            --cms-{key}
                            <input
                              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                              value={value}
                              onChange={(event) => {
                                try {
                                  const next = JSON.parse(
                                    canvasDraft,
                                  ) as CmsComponentDefinition;
                                  next.styleTokens = {
                                    ...next.styleTokens,
                                    [key]: event.target.value,
                                  };
                                  setCanvasDraft(JSON.stringify(next, null, 2));
                                } catch {
                                  // Keep invalid JSON in the code editor until it is repaired.
                                }
                              }}
                              disabled={disabled}
                            />
                          </label>
                        ))}
                        <label className="flex items-center gap-2 text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={Boolean(canvasDraftDefinition?.responsive)}
                            onChange={(event) => {
                              try {
                                const next = JSON.parse(
                                  canvasDraft,
                                ) as CmsComponentDefinition;
                                next.responsive = event.target.checked;
                                setCanvasDraft(JSON.stringify(next, null, 2));
                              } catch {
                                // Keep invalid JSON in the code editor until it is repaired.
                              }
                            }}
                            disabled={disabled}
                          />
                          Responsive component
                        </label>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {canvasDefinition.slots.length ? (
                          canvasDefinition.slots.map((slot) => (
                            <div
                              key={slot.name}
                              className="flex w-full flex-wrap items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-2 py-2"
                            >
                              <span className="mr-auto text-[10px] text-slate-600">
                                {slot.label}
                                {slot.multiple ? " · multiple" : ""}
                              </span>
                              {selectedEditorBlock?.componentId ===
                              canvasDefinition.id ? (
                                (slot.allowedComponentIds?.length
                                  ? slot.allowedComponentIds
                                  : componentDefinitions.map((item) => item.id)
                                ).map((componentId) => {
                                  const child = componentDefinitions.find(
                                    (item) => item.id === componentId,
                                  );
                                  return child ? (
                                    <button
                                      key={componentId}
                                      type="button"
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                      onClick={() =>
                                        addInstanceToSlot(
                                          slot.name,
                                          componentId,
                                        )
                                      }
                                    >
                                      <Plus className="mr-1 inline size-3" />
                                      {child.name}
                                    </button>
                                  ) : null;
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  Select this instance to populate
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">
                            No slots
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Component definition
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          Edit the reusable structure, props, slots, variants,
                          and tokens. Changes apply to future instances.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="h-8 shrink-0 rounded bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                        onClick={() => void saveCanvasDefinition()}
                        disabled={disabled || canvasSavePending}
                      >
                        {canvasSavePending ? "Saving..." : "Save definition"}
                      </button>
                      <button
                        type="button"
                        className="h-8 shrink-0 rounded border border-slate-600 px-3 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                        onClick={() => void publishCanvasDefinition()}
                        disabled={
                          disabled ||
                          canvasSavePending ||
                          componentStatuses[canvasDefinition.id] === "published"
                        }
                      >
                        {componentStatuses[canvasDefinition.id] === "published"
                          ? "Published"
                          : "Publish version"}
                      </button>
                    </div>
                    {canvasVisualBlock ? (
                      <div className="mt-4 rounded-lg border border-slate-700 bg-white p-3 text-slate-900">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Visual component canvas
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Edit the isolated DOM directly. Text changes
                              update the selected reusable variant.
                            </p>
                          </div>
                          <div
                            className="flex flex-wrap gap-1"
                            role="tablist"
                            aria-label="Component variants"
                          >
                            {canvasDefinition.variants.map((variant) => (
                              <button
                                key={variant.id}
                                type="button"
                                role="tab"
                                aria-selected={
                                  canvasVisualBlock.variantId === variant.id
                                }
                                className={`rounded border px-2 py-1 text-[10px] ${canvasVisualBlock.variantId === variant.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                                onClick={() => setCanvasVariantId(variant.id)}
                              >
                                {variant.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <iframe
                          ref={canvasVisualRef}
                          title="Isolated component definition canvas"
                          className="h-72 w-full rounded border border-dashed border-slate-300 bg-slate-50"
                          sandbox="allow-scripts"
                          srcDoc={canvasVisualDocument}
                        />
                        <p className="mt-2 text-[10px] text-slate-500">
                          Editable fields are marked from the component property
                          registry. Structure, slots, and unsupported elements
                          remain protected.
                        </p>
                      </div>
                    ) : null}
                    <textarea
                      value={canvasDraftDefinition?.markup ?? ""}
                      onChange={(event) => {
                        try {
                          const next = JSON.parse(
                            canvasDraft,
                          ) as CmsComponentDefinition;
                          next.markup = event.target.value || undefined;
                          setCanvasDraft(JSON.stringify(next, null, 2));
                        } catch {
                          // Keep invalid JSON in the code editor until it is repaired.
                        }
                      }}
                      spellCheck={false}
                      className="mt-3 min-h-32 w-full resize-y rounded border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      aria-label="Component HTML"
                      placeholder="Optional sanitized component HTML"
                    />
                    <textarea
                      value={canvasDraftDefinition?.styles ?? ""}
                      onChange={(event) => {
                        try {
                          const next = JSON.parse(
                            canvasDraft,
                          ) as CmsComponentDefinition;
                          next.styles = event.target.value || undefined;
                          setCanvasDraft(JSON.stringify(next, null, 2));
                        } catch {
                          // Keep invalid JSON in the code editor until it is repaired.
                        }
                      }}
                      spellCheck={false}
                      className="mt-3 min-h-32 w-full resize-y rounded border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      aria-label="Component CSS"
                      placeholder="Optional sanitized component CSS"
                    />
                    <textarea
                      value={canvasDraft}
                      onChange={(event) => setCanvasDraft(event.target.value)}
                      spellCheck={false}
                      className="mt-3 min-h-72 w-full resize-y rounded border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      aria-label="Main component definition JSON"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {canvasDefinition.variants.map((variant) => (
                    <article
                      key={variant.id}
                      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-medium text-slate-800">
                          {variant.label}
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          {variant.id}
                        </span>
                      </div>
                      <div className="min-h-32 overflow-hidden bg-slate-50 p-4">
                        <iframe
                          title={`${variant.label} component definition preview`}
                          className="h-32 w-full rounded border border-slate-200 bg-white"
                          sandbox="allow-scripts"
                          srcDoc={
                            canvasVariantPreviewDocuments.get(variant.id) ?? ""
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between px-4 py-3">
                        <p className="text-[10px] text-slate-400">
                          Definition variant
                        </p>
                        <button
                          type="button"
                          className="h-7 rounded border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            if (selected) {
                              setBuilderMode("instance");
                              updateSelectedVariant(variant.id);
                            } else {
                              addComponentVariant(canvasDefinition, variant.id);
                            }
                          }}
                        >
                          {selected ? "Use on instance" : "Add to page"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-xl rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Choose a main component
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Open Components and select a definition to inspect its
                  structure and variants.
                </p>
              </div>
            )
          ) : null}
          {!activeTool && builderMode === "instance" ? (
            <div
              className="mx-auto transition-[width] duration-200"
              style={{
                width: canvasWidth,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                marginBottom: `${(zoom - 100) * 4}px`,
              }}
            >
              <div className="overflow-hidden bg-white shadow-xl ring-1 ring-slate-900/10">
                <div className="flex h-9 items-center justify-between border-b border-slate-200 px-4 text-[10px] text-slate-400">
                  <span>
                    {currentPageId ? "Draft canvas" : "New page canvas"}
                  </span>
                  <span>{blocks.length} blocks</span>
                </div>
                <div
                  className="relative min-h-[620px] bg-white"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDropBlock(event)}
                >
                  <iframe
                    ref={iframeRef}
                    title="Storefront canvas"
                    sandbox={previewSandbox}
                    src={previewUrl}
                    className="block min-h-[720px] w-full border-0 bg-white"
                    style={{ pointerEvents: "auto" }}
                  />
                  {hoveredPreview ? (
                    <div
                      className="pointer-events-none absolute z-20 border border-blue-400/80 bg-blue-500/5 transition-[left,top,width,height] duration-75"
                      style={{
                        left: hoveredPreview.rect.x,
                        top: hoveredPreview.rect.y,
                        width: hoveredPreview.rect.width,
                        height: hoveredPreview.rect.height,
                      }}
                    >
                      <span className="absolute -top-6 left-0 rounded bg-blue-600 px-1.5 py-1 text-[10px] font-medium leading-none text-white shadow-sm">
                        {hoveredPreview.label}
                      </span>
                    </div>
                  ) : null}
                  {visibleSelectedPreview ? (
                    <div
                      className="pointer-events-none absolute z-10 border-2 border-blue-600 bg-blue-500/5 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
                      style={{
                        left: visibleSelectedPreview.rect.x,
                        top: visibleSelectedPreview.rect.y,
                        width: visibleSelectedPreview.rect.width,
                        height: visibleSelectedPreview.rect.height,
                      }}
                    >
                      <span className="absolute -top-6 left-0 rounded bg-blue-600 px-1.5 py-1 text-[10px] font-medium leading-none text-white shadow-sm">
                        {visibleSelectedPreview.label}
                      </span>
                    </div>
                  ) : null}
                  {!hoveredPreview && !visibleSelectedPreview ? (
                    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[10px] text-slate-500 shadow-sm">
                      <MousePointer2 className="mr-1 inline size-3" />
                      Select a section to edit it
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="sticky bottom-0 ml-auto mt-3 flex items-center gap-1 rounded-t border border-b-0 border-slate-300 bg-white px-3 py-2 text-[10px] font-medium text-slate-500 shadow-sm hover:text-slate-900"
            onClick={() => {
              setRightTab("code");
              setRightOpen(true);
              setMessage("Edit the page body source, then save the page.");
            }}
          >
            <span className="font-mono">&lt;/&gt;</span> Code editor
          </button>
        </main>
        {rightOpen ? (
          <aside className="z-30 flex min-h-0 w-[310px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white max-sm:absolute max-sm:right-0 max-sm:top-11 max-sm:bottom-0 max-sm:w-[min(310px,calc(100vw-40px))] max-sm:shadow-xl">
            <div
              role="tablist"
              aria-label="Element inspector"
              className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 px-3"
            >
              <button
                type="button"
                onClick={() => setRightTab("content")}
                role="tab"
                aria-selected={rightTab === "content"}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] ${rightTab === "content" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                <FileText className="size-3" />
                Content
              </button>
              <button
                type="button"
                onClick={() => setRightTab("style")}
                role="tab"
                aria-selected={rightTab === "style"}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] ${rightTab === "style" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                <Paintbrush className="size-3" />
                Style
              </button>
              <button
                type="button"
                onClick={() => setRightTab("advanced")}
                role="tab"
                aria-selected={rightTab === "advanced"}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] ${rightTab === "advanced" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                <Settings2 className="size-3" />
                Advanced
              </button>
              {selected ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setSelectedComponentId(null);
                    setSelectedPreview(null);
                  }}
                  className="ml-auto grid size-7 place-items-center rounded hover:bg-slate-100"
                  aria-label="Close properties"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rightTab === "settings" ? (
                <div className="p-4">{settings}</div>
              ) : rightTab === "code" ? (
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-xs font-medium text-slate-700">
                      Page body
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      This source is sanitized before storefront rendering. Save
                      after editing to publish the page body.
                    </p>
                  </div>
                  {onPageBodyChange ? (
                    <textarea
                      className="min-h-[420px] w-full rounded border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100 outline-none focus:border-blue-500"
                      value={pageBody ?? ""}
                      onChange={(event) => onPageBodyChange(event.target.value)}
                      disabled={disabled}
                      spellCheck={false}
                      aria-label="Page body source"
                    />
                  ) : (
                    <p className="rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-4 text-slate-500">
                      Homepage content is managed by structured components and
                      has no raw page body.
                    </p>
                  )}
                </div>
              ) : selected ? (
                <div className="space-y-4 p-4">
                  {visibleSelectedPreview?.id ? (
                    <div
                      key={visibleSelectedPreview.id}
                      className="space-y-3 rounded border border-blue-200 bg-blue-50/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                            Live DOM element
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-700">
                            {visibleSelectedPreview.tagName ?? "element"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {visibleSelectedPreview.id}
                        </span>
                      </div>
                      {visibleSelectedPreview.text ? (
                        <label className="block text-[10px] text-slate-600">
                          Content
                          <textarea
                            defaultValue={visibleSelectedPreview.text}
                            className="mt-1 min-h-16 w-full resize-y rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                            disabled={disabled}
                            onChange={(event) =>
                              sendDomMutation("textContent", event.target.value)
                            }
                            onBlur={(event) =>
                              sendDomMutation("textContent", event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                      {visibleSelectedPreview.href ? (
                        <label className="block text-[10px] text-slate-600">
                          Link URL
                          <input
                            defaultValue={visibleSelectedPreview.href}
                            className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                            disabled={disabled}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                            onBlur={(event) =>
                              sendDomMutation("href", event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                      {visibleSelectedPreview.src ? (
                        <label className="block text-[10px] text-slate-600">
                          Image URL
                          <input
                            defaultValue={visibleSelectedPreview.src}
                            className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                            disabled={disabled}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                            onBlur={(event) =>
                              sendDomMutation("src", event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "width",
                          "height",
                          "min-width",
                          "max-width",
                          "margin",
                          "padding",
                          "gap",
                          "display",
                          "position",
                          "color",
                          "background-color",
                          "background-size",
                          "background-position",
                          "font-family",
                          "font-size",
                          "font-weight",
                          "line-height",
                          "letter-spacing",
                          "border",
                          "border-radius",
                          "box-shadow",
                        ].map((property) => (
                          <label
                            key={property}
                            className="block text-[10px] text-slate-600"
                          >
                            {property}
                            <input
                              defaultValue={
                                visibleSelectedPreview.style?.[property] ?? ""
                              }
                              className="mt-1 h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                              disabled={disabled}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  event.currentTarget.blur();
                                }
                              }}
                              onBlur={(event) =>
                                sendDomMutation(
                                  `style.${property}`,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] leading-4 text-slate-500">
                        Changes apply to this live storefront element and are
                        recorded in the page history.
                      </p>
                    </div>
                  ) : null}
                  <label className="block text-[11px] text-slate-500">
                    Element
                    <input
                      className="mt-1 h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
                      value={selectedComponent?.label ?? LABELS[selected.type]}
                      readOnly
                    />
                  </label>
                  {selectedInstance ? (
                    <p className="rounded bg-slate-50 px-2.5 py-2 text-[11px] leading-4 text-slate-500">
                      Editing an instance inside {LABELS[selected.type]}.
                      Structure and style remain owned by the main component.
                    </p>
                  ) : null}
                  {selectedDefinition ? (
                    <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Component instance
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-700">
                            {selectedDefinition.name}
                          </p>
                        </div>
                      </div>
                      <label className="block text-[10px] text-slate-500">
                        Variant
                        <select
                          className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                          value={
                            selectedEditorBlock?.variantId ??
                            selectedDefinition.defaultVariantId ??
                            ""
                          }
                          onChange={(event) =>
                            updateSelectedVariant(event.target.value)
                          }
                          disabled={
                            disabled ||
                            Boolean(
                              selectedComponent?.fixed && !selectedInstance,
                            )
                          }
                        >
                          {selectedDefinition.variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <p className="text-[10px] text-slate-500">Slots</p>
                        <div className="mt-1 space-y-2">
                          {selectedDefinition.slots.length ? (
                            selectedDefinition.slots.map((slot) => (
                              <div
                                key={slot.name}
                                data-testid={`cms-slot-${selected.id}-${slot.name}`}
                                className="rounded border border-dashed border-slate-300 bg-white p-2 transition-colors hover:border-blue-400 hover:bg-blue-50/30"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => onDropSlot(event, slot.name)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-medium text-slate-600">
                                    {slot.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {selectedEditorBlock?.slots?.[slot.name]
                                      ?.length ?? 0}
                                  </span>
                                </div>
                                <div className="mt-1 space-y-1">
                                  {(
                                    selectedEditorBlock?.slots?.[slot.name] ??
                                    []
                                  ).map((child, index) => {
                                    const childDefinition =
                                      componentDefinitions.find(
                                        (definition) =>
                                          definition.id === child.componentId,
                                      );
                                    const childLabel =
                                      childDefinition?.name ??
                                      child.componentId;
                                    const itemCount =
                                      selectedEditorBlock?.slots?.[slot.name]
                                        ?.length ?? 0;
                                    return (
                                      <div
                                        key={child.id}
                                        draggable={!disabled}
                                        onDragOver={(event) =>
                                          event.preventDefault()
                                        }
                                        onDrop={(event) => {
                                          event.stopPropagation();
                                          onDropSlot(event, slot.name, index);
                                        }}
                                        onDragStart={(event) =>
                                          event.dataTransfer.setData(
                                            "application/x-cms-component-instance",
                                            JSON.stringify({
                                              id: child.id,
                                              blockId: selected.id,
                                              componentId: child.componentId,
                                            }),
                                          )
                                        }
                                        className="flex items-center gap-1 rounded bg-slate-50 px-2 py-1"
                                      >
                                        <button
                                          type="button"
                                          className="min-w-0 flex-1 truncate text-left text-[10px] text-slate-600 hover:text-slate-900"
                                          onClick={() => {
                                            setSelectedId(selected.id);
                                            setSelectedComponentId(child.id);
                                            setRightTab("content");
                                          }}
                                        >
                                          {childLabel}
                                        </button>
                                        <button
                                          type="button"
                                          className="grid size-5 place-items-center rounded text-slate-500 hover:bg-white disabled:opacity-30"
                                          onClick={() =>
                                            moveInstanceInSlot(
                                              slot.name,
                                              index,
                                              -1,
                                            )
                                          }
                                          disabled={disabled || index === 0}
                                          aria-label={`Move ${childLabel} up`}
                                        >
                                          <ChevronLeft className="size-3 rotate-90" />
                                        </button>
                                        <button
                                          type="button"
                                          className="grid size-5 place-items-center rounded text-slate-500 hover:bg-white disabled:opacity-30"
                                          onClick={() =>
                                            moveInstanceInSlot(
                                              slot.name,
                                              index,
                                              1,
                                            )
                                          }
                                          disabled={
                                            disabled || index === itemCount - 1
                                          }
                                          aria-label={`Move ${childLabel} down`}
                                        >
                                          <ChevronRight className="size-3 rotate-90" />
                                        </button>
                                        <button
                                          type="button"
                                          className="grid size-5 place-items-center rounded text-red-500 hover:bg-red-50"
                                          onClick={() =>
                                            removeInstanceFromSlot(
                                              slot.name,
                                              index,
                                            )
                                          }
                                          disabled={disabled}
                                          aria-label={`Remove ${childLabel}`}
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              No slots defined
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] leading-4 text-slate-400">
                        Structure and style tokens are owned by the main
                        component. This instance can change props, slots, and
                        its selected variant.
                      </p>
                    </div>
                  ) : null}
                  {rightTab === "content" ? (
                    <>
                      {selectedVisualDefinition && selectedEditorBlock ? (
                        <VisualPropertyFields
                          block={selectedEditorBlock}
                          definition={selectedVisualDefinition}
                          disabled={disabled}
                          onPickMedia={pickMediaForSelected}
                          onChange={(key, value) => {
                            const markup = visualMarkupWithProperty(
                              text(
                                selectedEditorBlock.props.markup,
                                selectedVisualDefinition.markup,
                              ),
                              selectedVisualDefinition,
                              key,
                              String(value),
                            );
                            updateSelected({
                              ...selectedEditorBlock.props,
                              [key]: value,
                              markup,
                            });
                            setMessage("Vvveb property updated.");
                          }}
                        />
                      ) : (
                        <BlockPropertyFields
                          block={selectedEditorBlock ?? selected}
                          definition={selectedDefinition}
                          disabled={disabled}
                          focus={selectedComponent ?? selectedPreviewFocus}
                          onPickMedia={pickMediaForSelected}
                          onChange={(key, value) => {
                            updateSelected({
                              ...(selectedEditorBlock?.props ?? {}),
                              [key]: value,
                            });
                            setMessage("Property updated.");
                          }}
                        />
                      )}
                    </>
                  ) : null}
                  {rightTab === "layout" ||
                  rightTab === "style" ||
                  rightTab === "responsive" ? (
                    <>
                      {rightTab === "style" ? (
                        <div className="rounded border border-slate-200 p-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[10px] text-slate-500">
                              State
                              <select
                                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                                value={styleState}
                                onChange={(event) =>
                                  setStyleState(event.target.value)
                                }
                                disabled={disabled}
                              >
                                <option value="">- State -</option>
                                <option value="hover">hover</option>
                                <option value="active">active</option>
                                <option value="nth-of-type(2n)">
                                  nth-of-type(2n)
                                </option>
                              </select>
                            </label>
                            <label className="text-[10px] text-slate-500">
                              Theme
                              <select
                                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                                value={styleTheme ?? ""}
                                onChange={(event) =>
                                  setStyleTheme(
                                    (event.target.value || null) as StyleTheme,
                                  )
                                }
                                disabled={disabled}
                              >
                                <option value="">- Theme Auto -</option>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      ) : null}
                      <LayoutFields
                        block={selectedEditorBlock ?? selected}
                        disabled={
                          disabled ||
                          Boolean(selectedComponent?.fixed && !selectedInstance)
                        }
                        onChange={(layout) =>
                          updateSelected({
                            ...(selectedEditorBlock?.props ?? {}),
                            layout: {
                              ...(selectedEditorBlock?.props.layout &&
                              typeof selectedEditorBlock.props.layout ===
                                "object"
                                ? selectedEditorBlock.props.layout
                                : {}),
                              ...layout,
                            },
                          })
                        }
                        onAccessibilityChange={(accessibility) =>
                          updateSelected({
                            ...(selectedEditorBlock?.props ?? {}),
                            accessibility,
                          })
                        }
                      />
                    </>
                  ) : null}
                  {rightTab === "advanced" ? (
                    <details open className="rounded border border-slate-200">
                      <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-slate-600">
                        Advanced JSON
                      </summary>
                      <textarea
                        className="min-h-48 w-full border-t border-slate-200 bg-white p-2 font-mono text-[11px] leading-5 text-slate-700 outline-none"
                        value={propsDraft}
                        onChange={(e) => setPropsDraft(e.target.value)}
                        onBlur={() => {
                          try {
                            const parsed = JSON.parse(propsDraft) as unknown;
                            if (
                              parsed &&
                              typeof parsed === "object" &&
                              !Array.isArray(parsed)
                            ) {
                              updateSelected(parsed as Record<string, unknown>);
                              setMessage("Properties updated.");
                            }
                          } catch {
                            setMessage("Properties must be valid JSON.");
                          }
                        }}
                        disabled={disabled}
                        aria-label="Advanced block properties JSON"
                      />
                    </details>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-label="Move selected block left"
                      className="h-8 rounded border border-slate-200 text-xs hover:bg-slate-50 disabled:opacity-30"
                      onClick={() => move(-1)}
                      disabled={
                        disabled ||
                        FIXED_COMPONENT_TYPES.has(selected.type) ||
                        blocks.findIndex((b) => b.id === selected.id) === 0
                      }
                    >
                      <ChevronLeft className="mx-auto size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move selected block right"
                      className="h-8 rounded border border-slate-200 text-xs hover:bg-slate-50 disabled:opacity-30"
                      onClick={() => move(1)}
                      disabled={
                        disabled ||
                        FIXED_COMPONENT_TYPES.has(selected.type) ||
                        blocks.findIndex((b) => b.id === selected.id) ===
                          blocks.length - 1
                      }
                    >
                      <ChevronRight className="mx-auto size-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="h-8 w-full rounded border border-red-200 text-xs text-red-600 hover:bg-red-50"
                    onClick={removeSelected}
                    disabled={
                      disabled ||
                      Boolean(selectedInstance) ||
                      FIXED_COMPONENT_TYPES.has(selected.type)
                    }
                  >
                    Remove component
                  </button>
                </div>
              ) : (
                <div
                  className="m-3 flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500"
                  role="alert"
                >
                  <button
                    type="button"
                    className="grid size-6 shrink-0 place-items-center rounded hover:bg-white"
                    aria-label="Close"
                    title="Close"
                    onClick={() => setRightOpen(false)}
                  >
                    <X className="size-3.5" />
                  </button>
                  <span>
                    <strong className="font-semibold text-slate-700">
                      No selected element!
                    </strong>{" "}
                    Click on an element to edit.
                  </span>
                </div>
              )}
              {message ? (
                <p
                  className="mx-4 rounded bg-slate-100 px-2.5 py-2 text-[11px] text-slate-500"
                  role="status"
                >
                  {message}
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}
        <CatalogMediaPickerDialog
          open={mediaPickerTarget !== null}
          onClose={() => setMediaPickerTarget(null)}
          addPlacement="main"
          onAddPlacementChange={() => undefined}
          onPickMany={applyPickedMedia}
          mediaScope="catalog"
        />
      </div>
    </section>
  );
  return immersive && typeof document !== "undefined"
    ? createPortal(surface, document.body)
    : surface;
}
