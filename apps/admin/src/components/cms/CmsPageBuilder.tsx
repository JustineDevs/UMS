"use client";

import type {
  CmsBlock,
  CmsComponentDefinition,
  CmsComponentInstance,
  CmsPageBlockPresetRow,
} from "@universal-music-store/platform-data";
import {
  blockFromComponentInstance,
  componentInstanceFromBlock,
  listCmsComponentDefinitions,
} from "@universal-music-store/platform-data";
import { cmsComponentDefinitionSchema } from "@/lib/cms-component-contract";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { createPortal } from "react-dom";
import { CatalogMediaPickerDialog } from "@/components/catalog/CatalogMediaPickerDialog";
import { CmsPagesManager } from "./CmsPagesManager";
import { CmsSiteMapPanel } from "./CmsSiteMapPanel";
import { CmsNavigationEditor } from "./CmsNavigationEditor";
import { CmsAnnouncementEditor } from "./CmsAnnouncementEditor";
import { CmsCategoryEditor } from "./CmsCategoryEditor";
import { CmsMediaManager } from "./CmsMediaManager";
import { CmsBlogManager } from "./CmsBlogManager";
import { CmsFormsTable } from "./CmsFormsTable";
import { CmsRedirectsManager } from "./CmsRedirectsManager";
import { CmsExperimentsManager } from "./CmsExperimentsManager";
import { CmsCommerceSearch } from "./CmsCommerceSearch";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePlus2,
  Layers3,
  Maximize2,
  Monitor,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  MousePointer2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";

const BLOCK_TYPES = [
  {
    type: "storefront_header",
    label: "Storefront navbar",
    group: "Global components",
  },
  {
    type: "header_navigation",
    label: "Header navigation",
    group: "Global components",
  },
  {
    type: "header_actions",
    label: "Header actions",
    group: "Global components",
  },
  { type: "hero", label: "Hero banner", group: "Sections" },
  { type: "two_column", label: "Two column", group: "Sections" },
  { type: "trust_strip", label: "Trust strip", group: "Sections" },
  { type: "contact_strip", label: "Contact strip", group: "Sections" },
  { type: "newsletter", label: "Newsletter", group: "Commerce" },
  { type: "featured_products", label: "Featured products", group: "Commerce" },
  { type: "home_tiles", label: "Homepage category tiles", group: "Homepage" },
  {
    type: "latest_section",
    label: "Latest products section",
    group: "Homepage",
  },
  { type: "rich_text", label: "Rich text", group: "Content" },
  { type: "image", label: "Image", group: "Content" },
  { type: "cta_row", label: "Call to action", group: "Content" },
  { type: "faq", label: "FAQ", group: "Content" },
  { type: "video", label: "Video", group: "Content" },
  { type: "divider", label: "Spacer", group: "Content" },
  {
    type: "storefront_footer",
    label: "Storefront footer",
    group: "Global components",
  },
  {
    type: "footer_columns",
    label: "Footer columns",
    group: "Global components",
  },
] as const;

const FIXED_COMPONENT_TYPES = new Set([
  "storefront_header",
  "header_navigation",
  "header_actions",
  "storefront_footer",
  "footer_columns",
]);

type BuilderPage = { id: string; title: string; slug: string; status: string };
type PreviewTarget = {
  id: string;
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
const LABELS: Record<string, string> = Object.fromEntries(
  BLOCK_TYPES.map((b) => [b.type, b.label]),
);

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `block_${Date.now()}`;
}

function defaults(type: string): Record<string, unknown> {
  switch (type) {
    case "storefront_header":
      return { editorHref: "/admin/cms/navigation" };
    case "header_navigation":
      return { editorHref: "/admin/cms/navigation" };
    case "header_actions":
      return { editorHref: "/admin/cms/navigation" };
    case "storefront_footer":
      return { editorHref: "/admin/cms/navigation" };
    case "footer_columns":
      return { editorHref: "/admin/cms/navigation" };
    case "hero":
      return {
        title: "New hero",
        subtitle: "Add a short introduction",
        imageUrl: "",
        mediaType: "image",
        videoUrl: "",
        href: "/",
        ctaLabel: "Learn more",
      };
    case "two_column":
      return {
        html: "<p>Tell your story here.</p>",
        imageUrl: "",
        imageAlt: "",
        reverse: false,
      };
    case "trust_strip":
      return {
        col1Title: "Secure checkout",
        col1Body: "",
        col2Title: "Fast shipping",
        col2Body: "",
        col3Title: "Easy returns",
        col3Body: "",
      };
    case "contact_strip":
      return { phone: "", email: "", hours: "" };
    case "newsletter":
      return { heading: "Stay in the loop", subtitle: "", actionUrl: "" };
    case "featured_products":
      return { slugs: "" };
    case "home_tiles":
      return { tiles: [] };
    case "latest_section":
      return {
        title: "THE LATEST DROPS",
        viewAllLabel: "View All Products",
        viewAllHref: "/shop",
      };
    case "rich_text":
      return { html: "<p>Start writing...</p>" };
    case "image":
      return { src: "", alt: "" };
    case "cta_row":
      return { label: "Continue", href: "/" };
    case "faq":
      return { items: [{ q: "Question?", a: "Answer." }] };
    case "video":
      return { url: "", title: "Video" };
    case "divider":
      return { heightPx: 24 };
    default:
      return {};
  }
}

function normalize(raw: unknown): CmsBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    const row =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const type =
      typeof row.type === "string" && LABELS[row.type] ? row.type : "rich_text";
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
        row.props && typeof row.props === "object"
          ? (row.props as Record<string, unknown>)
          : defaults(type),
    } as CmsBlock;
  });
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback);
}
function plainHtml(value: unknown) {
  return sanitizeCmsHtml(text(value));
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

function layoutStyle(props: Record<string, unknown>) {
  const raw = props.layout;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const layout = raw as Record<string, unknown>;
  const safe = (key: string) => {
    const value = text(layout[key]).trim();
    return /^[0-9a-zA-Z.#%(),/\-\s]+$/.test(value) ? value : "";
  };
  const styles = [
    ["max-width", safe("maxWidth")],
    ["min-height", safe("minHeight")],
    ["padding-block", safe("paddingBlock")],
    ["padding-inline", safe("paddingInline")],
    ["margin-block", safe("marginBlock")],
    ["margin-inline", safe("marginInline")],
    ["display", safe("display")],
    ["position", safe("position")],
    ["inset", safe("inset")],
    ["font-size", safe("fontSize")],
    ["font-weight", safe("fontWeight")],
    ["color", safe("color")],
    ["background-color", safe("backgroundColor")],
    ["border-radius", safe("borderRadius")],
  ].filter(([, value]) => value);
  return styles.length
    ? ` style="${styles.map(([key, value]) => `${key}:${escapeHtml(value)}`).join(";")}"`
    : "";
}

function blockHtml(block: CmsBlock): string {
  const p = block.props;
  const id = escapeHtml(block.id);
  const label = escapeHtml(LABELS[block.type] ?? block.type);
  const componentId = escapeHtml(
    block.componentId ?? block.type.replaceAll("_", "-"),
  );
  const variantId = escapeHtml(block.variantId ?? "default");
  const slots = Object.entries(block.slots ?? {})
    .map(
      ([slot, items]) =>
        `<div data-cms-slot="${escapeHtml(slot)}" data-cms-id="${escapeHtml(`${block.id}::slot::${slot}`)}" data-cms-label="${escapeHtml(slot)}">${items.map((item) => blockHtml(blockFromComponentInstance(item))).join("")}</div>`,
    )
    .join("");
  const wrap = (content: string, className = "") =>
    annotateMarkup(
      block,
      `<section data-cms-id="${id}" data-cms-label="${label}" data-cms-component-id="${componentId}" data-cms-variant="${variantId}" class="cms-node ${className}"${layoutStyle(p)}>${content}${slots}</section>`,
    );
  switch (block.type) {
    case "storefront_header":
    case "header_navigation":
    case "header_actions":
    case "storefront_footer":
    case "footer_columns":
      return "";
    case "hero":
      return wrap(
        `<div class="hero-inner"${p.imageUrl && p.mediaType !== "video" ? ` style="background-image:linear-gradient(90deg,rgba(2,6,23,.94),rgba(2,6,23,.38)),url('${escapeHtml(p.imageUrl)}')"` : ""}>${p.mediaType === "video" && p.videoUrl ? `<video class="hero-media" src="${escapeHtml(p.videoUrl)}" autoplay muted loop playsinline></video>` : ""}<div class="hero-copy"><span class="eyebrow">Featured collection</span><h2>${escapeHtml(p.title || "New hero")}</h2><p>${escapeHtml(p.subtitle || "Add a short introduction")}</p><a href="${escapeHtml(p.href || "#")}">${escapeHtml(p.ctaLabel || "Learn more")}</a></div></div>`,
        "hero",
      );
    case "rich_text":
      return wrap(
        `<div class="rich-text">${plainHtml(p.html) || "<p class='muted'>Start writing...</p>"}</div>`,
      );
    case "image":
      return wrap(
        p.src
          ? `<figure><img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt)}"><figcaption>${escapeHtml(p.alt || "Image")}</figcaption></figure>`
          : `<div class="placeholder">Add an image URL</div>`,
      );
    case "two_column":
      return wrap(
        `<div class="two-column ${p.reverse ? "reverse" : ""}"><div class="rich-text">${plainHtml(p.html) || "<p>Tell your story here.</p>"}</div><div class="media-placeholder">${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.imageAlt)}">` : "Image column"}</div></div>`,
      );
    case "cta_row":
      return wrap(
        `<div class="cta-row"><a href="${escapeHtml(p.href || "#")}">${escapeHtml(p.label || "Continue")}</a></div>`,
      );
    case "trust_strip":
      return wrap(
        `<div class="trust-strip">${[1, 2, 3].map((i) => `<div><strong>${escapeHtml(p[`col${i}Title`] || "Trust point")}</strong><span>${escapeHtml(p[`col${i}Body`] || "Add supporting detail")}</span></div>`).join("")}</div>`,
      );
    case "contact_strip":
      return wrap(
        `<div class="contact-strip"><span>${escapeHtml(p.phone || "Phone")}</span><span>${escapeHtml(p.email || "Email")}</span><span>${escapeHtml(p.hours || "Business hours")}</span></div>`,
      );
    case "newsletter":
      return wrap(
        `<div class="newsletter"><h2>${escapeHtml(p.heading || "Stay in the loop")}</h2><p>${escapeHtml(p.subtitle || "Subscribe for updates")}</p><div class="newsletter-form"><span>Email address</span><b>Subscribe</b></div></div>`,
      );
    case "featured_products":
      return wrap(
        `<div class="featured"><h3>Featured products</h3><div class="product-grid">${[1, 2, 3, 4].map((i) => `<div><span></span><small>Product ${i}</small></div>`).join("")}</div></div>`,
      );
    case "home_tiles":
      return wrap(
        `<div class="home-tiles" style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.8fr);gap:12px;padding:12px">${(Array.isArray(
          p.tiles,
        )
          ? p.tiles
          : []
        )
          .map((item) => {
            const tile =
              item && typeof item === "object"
                ? (item as Record<string, unknown>)
                : {};
            return `<div class="home-tile ${escapeHtml(tile.variant || "large")}" style="min-height:150px;display:grid;align-content:end;gap:5px;padding:22px;border-radius:10px;background-color:#334155;color:#fff;${tile.imageUrl ? `background-image:linear-gradient(90deg,rgba(15,23,42,.82),rgba(15,23,42,.25)),url('${escapeHtml(tile.imageUrl)}')` : ""}"><strong>${escapeHtml(tile.title || "Category")}</strong><span style="color:rgba(255,255,255,.78)">${escapeHtml(tile.subtitle || "Explore the collection")}</span><a href="${escapeHtml(tile.href || "#")}" style="color:#fff;text-decoration:underline;text-underline-offset:3px">${escapeHtml(tile.linkLabel || "Shop now")}</a></div>`;
          })
          .join("")}</div>`,
      );
    case "latest_section":
      return wrap(
        `<div class="latest"><div><strong>${escapeHtml(p.title || "THE LATEST DROPS")}</strong><a href="${escapeHtml(p.viewAllHref || "/shop")}">${escapeHtml(p.viewAllLabel || "View All Products")}</a></div><div class="product-grid">${[1, 2, 3, 4].map((i) => `<div><span></span><small>Latest product ${i}</small></div>`).join("")}</div></div>`,
      );
    case "faq":
      return wrap(
        `<div class="faq">${(Array.isArray(p.items) ? p.items : [])
          .slice(0, 6)
          .map((item) => {
            const row =
              item && typeof item === "object"
                ? (item as Record<string, unknown>)
                : {};
            return `<details><summary>${escapeHtml(row.q || "Question")}</summary><div>${plainHtml(row.a) || "Answer"}</div></details>`;
          })
          .join("")}</div>`,
      );
    case "video":
      return wrap(
        `<div class="video"><span>${escapeHtml(p.title || "Video preview")}</span><small>${escapeHtml(p.url || "Add a video URL")}</small></div>`,
      );
    case "divider":
      return wrap(
        `<div style="height:${Math.max(16, Number(p.heightPx) || 24)}px" class="divider"></div>`,
      );
    default:
      return wrap(`<div class="placeholder">${label}</div>`);
  }
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
) {
  if (!blockId || !blocks.some((block) => block.id === blockId)) return blocks;
  return blocks.map((block) => {
    if (block.id !== blockId) return block;
    const domOverrides =
      block.props.domOverrides && typeof block.props.domOverrides === "object"
        ? (block.props.domOverrides as Record<string, Record<string, string>>)
        : {};
    return {
      ...block,
      props: {
        ...block.props,
        domOverrides: {
          ...domOverrides,
          [nodeId]: { ...(domOverrides[nodeId] ?? {}), [property]: value },
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

function childAttrs(block: CmsBlock, key: string, label: string) {
  return ` data-cms-id="${escapeHtml(componentChildId(block, key))}" data-cms-label="${escapeHtml(label)}"`;
}

function annotateMarkup(block: CmsBlock, markup: string) {
  const attr = (key: string, label: string) => childAttrs(block, key, label);
  switch (block.type) {
    case "hero":
      return markup
        .replace(
          '<span class="eyebrow">',
          '<span class="eyebrow"' + attr("eyebrow", "Eyebrow") + ">",
        )
        .replace("<h2>", "<h2" + attr("title", "Headline") + ">")
        .replace("<p>", "<p" + attr("subtitle", "Supporting text") + ">")
        .replace("<a href=", "<a" + attr("cta", "Primary action") + " href=");
    case "rich_text":
      return markup.replace(
        '<div class="rich-text">',
        '<div class="rich-text"' + attr("content", "Text content") + ">",
      );
    case "image":
      return markup
        .replace("<figure>", "<figure" + attr("media", "Image") + ">")
        .replace(
          "<figcaption>",
          "<figcaption" + attr("caption", "Caption") + ">",
        );
    case "two_column":
      return markup
        .replace(
          '<div class="rich-text">',
          '<div class="rich-text"' + attr("content", "Text content") + ">",
        )
        .replace(
          '<div class="media-placeholder">',
          '<div class="media-placeholder"' + attr("media", "Image") + ">",
        );
    case "cta_row":
      return markup.replace(
        "<a href=",
        "<a" + attr("action", "Action") + " href=",
      );
    case "contact_strip":
      return markup
        .replace("<span>", "<span" + attr("phone", "Phone") + ">")
        .replace("<span>", "<span" + attr("email", "Email") + ">")
        .replace("<span>", "<span" + attr("hours", "Business hours") + ">");
    case "home_tiles": {
      let index = 0;
      return markup
        .replace(
          '<div class="home-tiles"',
          '<div class="home-tiles"' + attr("grid", "Tile grid"),
        )
        .replace(/<div class="home-tile /g, () => {
          const value =
            "<div" +
            attr(`tile-${index}`, `Category tile ${index + 1}`) +
            ' class="home-tile ';
          index += 1;
          return value;
        });
    }
    case "newsletter":
      return markup
        .replace("<h2>", "<h2" + attr("heading", "Signup heading") + ">")
        .replace(
          '<div class="newsletter-form">',
          '<div class="newsletter-form"' + attr("form", "Signup form") + ">",
        );
    case "featured_products":
      return markup
        .replace("<h3>", "<h3" + attr("heading", "Section heading") + ">")
        .replace(
          '<div class="product-grid">',
          '<div class="product-grid"' + attr("grid", "Product grid") + ">",
        );
    case "latest_section":
      return markup
        .replace(
          "<div><strong>",
          "<div" + attr("header", "Section heading") + "><strong>",
        )
        .replace(
          '<div class="product-grid">',
          '<div class="product-grid"' + attr("products", "Product grid") + ">",
        );
    case "video":
      return markup.replace(
        '<div class="video">',
        '<div class="video"' + attr("player", "Video player") + ">",
      );
    case "divider":
      return markup.replace(
        'class="divider"',
        'class="divider"' + attr("spacer", "Spacer"),
      );
    case "faq": {
      let index = 0;
      return markup.replace(/<details>/g, () => {
        const value =
          "<details" + attr(`question-${index}`, `Question ${index + 1}`) + ">";
        index += 1;
        return value;
      });
    }
    default:
      return markup;
  }
}

function canvasDocument(pageBody: string, blocks: CmsBlock[]) {
  const body = blocks.map(blockHtml).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;background:#fff;color:#1e293b;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}body{min-height:100vh}.sitebar{height:46px;border-bottom:1px solid #e2e8f0;padding:0 28px;display:flex;align-items:center;justify-content:space-between;color:#475569;font-size:12px}.sitebar nav{display:flex;gap:22px;color:#94a3b8;font-size:11px}.page{padding:14px;display:grid;gap:12px}.cms-node{position:relative;cursor:pointer;border:2px solid transparent;transition:border-color .15s,box-shadow .15s}.cms-node:hover{border-color:#93c5fd}.cms-node[data-selected="true"]{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb22}.cms-node:after{content:attr(data-cms-label);display:none;position:absolute;top:-21px;left:-2px;background:#2563eb;color:#fff;padding:2px 7px;border-radius:4px 4px 0 0;font:600 10px/16px ui-sans-serif}.cms-node[data-selected="true"]:after{display:block}.hero{overflow:hidden;background:#020617;color:#fff}.hero-inner{position:relative;min-height:270px;padding:54px 54px;display:flex;align-items:center;background-position:center;background-size:cover}.hero-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62}.hero-copy{position:relative;z-index:1}.hero h2{font-size:34px;line-height:1.05;margin:12px 0 10px;max-width:560px}.hero p{color:#cbd5e1;max-width:460px}.hero a,.cta-row a{display:inline-block;margin-top:18px;border-radius:999px;background:#fff;color:#0f172a;padding:9px 17px;font-weight:600;text-decoration:none;font-size:12px}.eyebrow{color:#94a3b8;text-transform:uppercase;letter-spacing:.18em;font-size:10px;font-weight:700}.rich-text{padding:28px 34px}.rich-text h1,.rich-text h2,.rich-text h3{margin-top:0}.two-column{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:28px 34px;align-items:center}.two-column.reverse .rich-text{order:2}.media-placeholder,.placeholder{min-height:150px;display:grid;place-items:center;border-radius:10px;background:#f1f5f9;color:#94a3b8}.media-placeholder img,figure img{display:block;width:100%;height:100%;min-height:180px;object-fit:cover;border-radius:10px}.trust-strip,.contact-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:24px;background:#f8fafc}.trust-strip div{display:grid;gap:5px}.trust-strip span{color:#64748b;font-size:12px}.contact-strip{background:#fff;padding:25px 34px}.cta-row{padding:28px;text-align:center}.newsletter{padding:38px 34px;background:#0f172a;color:#fff}.newsletter h2{margin:0}.newsletter p{color:#94a3b8}.newsletter-form{display:flex;justify-content:space-between;max-width:440px;border:1px solid #334155;color:#94a3b8;padding:10px 12px;border-radius:7px}.newsletter-form b{color:#0f172a;background:#fff;padding:3px 9px;border-radius:4px;font-size:11px}.featured{padding:28px 34px}.featured h3{margin:0}.product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}.product-grid div{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.product-grid span{display:block;height:90px;background:#f1f5f9}.product-grid small{display:block;padding:10px;color:#64748b}.faq{padding:25px 34px}.faq details{padding:12px 0;border-bottom:1px solid #e2e8f0}.faq summary{font-weight:600;cursor:pointer}.faq details div{padding-top:8px;color:#64748b}.video{aspect-ratio:16/7;display:grid;place-items:center;background:#0f172a;color:#e2e8f0}.video small{color:#94a3b8}.divider{border-top:1px dashed #cbd5e1}.muted{color:#94a3b8}@media(max-width:600px){.sitebar{padding:0 16px}.sitebar nav{display:none}.hero-inner{padding:38px 25px}.hero h2{font-size:28px}.two-column,.trust-strip,.contact-strip{grid-template-columns:1fr}.two-column.reverse .rich-text{order:0}.product-grid{grid-template-columns:repeat(2,1fr)}}
  .latest{padding:28px 34px}.latest>div:first-child{display:flex;justify-content:space-between;align-items:center}.latest a{color:#2563eb;font-size:12px}.home-tiles{display:grid;grid-template-columns:1.35fr .8fr;gap:12px;padding:12px}.home-tile{min-height:150px;display:grid;align-content:end;gap:5px;padding:22px;border-radius:10px;background:#e2e8f0;background-position:center;background-size:cover;color:#fff}.home-tile.wide{grid-column:1/-1}.home-tile span{color:#cbd5e1;font-size:12px}.home-tile a{color:#fff;font-size:11px;text-decoration:underline}@media(max-width:600px){.home-tiles{grid-template-columns:1fr}.home-tile.wide{grid-column:auto}}
  </style></head><body><header class="sitebar cms-node" data-cms-id="storefront-header" data-cms-label="Storefront navbar"><strong>Storefront</strong><nav data-cms-id="header-navigation" data-cms-label="Header navigation"><span>Home</span><span>Catalog</span><span>About</span><span>Contact</span></nav><span data-cms-id="header-actions" data-cms-label="Header actions">Account · Bag</span></header><main class="page">${pageBody ? `<article class="cms-node" data-cms-id="page-body" data-cms-label="Page body"><div class="rich-text">${plainHtml(pageBody)}</div></article>` : ""}${body}${!pageBody && !body ? `<div class="placeholder" style="min-height:520px">Drop a section here or add one from Components</div>` : ""}</main><footer class="muted cms-node" data-cms-id="storefront-footer" data-cms-label="Storefront footer" style="padding:28px 34px;border-top:1px solid #f1f5f9"><div data-cms-id="footer-columns" data-cms-label="Footer columns">Storefront footer columns</div></footer><script>function parentOrigin(){try{return document.referrer?new URL(document.referrer).origin:window.location.origin}catch(e){return window.location.origin}}function nodeRect(n){var r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}function sendNode(source,n){parent.postMessage({source:source,id:n?n.dataset.cmsId:null,label:n?n.dataset.cmsLabel:null,rect:n?nodeRect(n):null},parentOrigin())}function selectNode(id,notify){document.querySelectorAll('[data-cms-id]').forEach(function(x){x.dataset.selected=x.dataset.cmsId===id?'true':'false'});var n=id?document.querySelector('[data-cms-id="'+CSS.escape(id)+'"]'):null;if(n&&n.dataset.selected!=='true')n.scrollIntoView({block:'nearest'});if(notify)sendNode('cms-builder',n)}document.addEventListener('pointerover',function(e){var n=e.target.closest('[data-cms-id]');if(n)sendNode('cms-builder-hover',n)},true);document.addEventListener('pointerout',function(e){if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('[data-cms-id]'))sendNode('cms-builder-hover',null)},true);document.addEventListener('click',function(e){var n=e.target.closest('[data-cms-id]');if(!n)return;e.preventDefault();selectNode(n.dataset.cmsId,true)},true);window.addEventListener('scroll',function(){var n=document.querySelector('[data-cms-id][data-selected="true"]');if(n)sendNode('cms-builder',n)},true);window.addEventListener('resize',function(){var n=document.querySelector('[data-cms-id][data-selected="true"]');if(n)sendNode('cms-builder',n)});window.addEventListener('message',function(e){if(e.source!==parent||e.origin!==parentOrigin()||!e.data||e.data.source!=='cms-builder-select')return;selectNode(e.data.id,false)});parent.postMessage({source:'cms-preview-ready'},parentOrigin());</script></body></html>`;
}

function canvasEditorRuntime(blocks: CmsBlock[]) {
  const overrides = Object.fromEntries(
    blocks.flatMap((block) => {
      const value = block.props.domOverrides;
      return value && typeof value === "object" && !Array.isArray(value)
        ? [[block.id, value]]
        : [];
    }),
  );
  const payload = JSON.stringify(overrides).replace(/</g, "\\u003c");
  return `<script>(function(){var overrides=${payload};var allowedStyle={display:1,position:1,width:1,height:1,margin:1,padding:1,color:1,"background-color":1,"font-size":1,"font-weight":1,"border-radius":1};function origin(){try{return document.referrer?new URL(document.referrer).origin:window.location.origin}catch(e){return window.location.origin}}function blockId(id){return id&&id.indexOf("::")>-1?id.split("::")[0]:id}function node(id){return id?document.querySelector('[data-cms-id="'+CSS.escape(id)+'"]'):null}function rect(n){var r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}function send(source,n){if(!n){parent.postMessage({source:source,id:null},origin());return}var id=n.dataset.cmsId||"",anchor=n instanceof HTMLAnchorElement?n:n.closest("a[href]"),media=n instanceof HTMLImageElement?n:n.closest("img[src]"),style={};Object.keys(allowedStyle).forEach(function(k){var v=n.style.getPropertyValue(k);if(v)style[k]=v});parent.postMessage({source:source,id:id,blockId:blockId(id),label:n.dataset.cmsLabel||id,tagName:n.tagName.toLowerCase(),text:n.children.length===0?(n.textContent||"").slice(0,2000):"",href:anchor?anchor.href:"",src:media?media.src:"",style:style,rect:rect(n)},origin())}function apply(){Object.keys(overrides).forEach(function(b){var map=overrides[b]||{};Object.keys(map).forEach(function(id){var n=node(id);if(!n)return;Object.keys(map[id]||{}).forEach(function(prop){var v=String(map[id][prop]??"");if(prop==="textContent"&&n.children.length===0)n.textContent=v;else if(prop==="href"&&n instanceof HTMLAnchorElement)n.href=v;else if(prop==="src"&&n instanceof HTMLImageElement)n.src=v;else if(prop.indexOf("style.")===0&&allowedStyle[prop.slice(6)])n.style.setProperty(prop.slice(6),v)})})})}var selected=null;apply();document.addEventListener("click",function(e){var n=e.target.closest&&e.target.closest("[data-cms-id]");if(!n)return;selected=n;send("cms-builder",n)},true);window.addEventListener("message",function(e){if(e.source!==parent||e.origin!==origin()||!e.data||e.data.source!=="cms-builder-dom-edit")return;var n=selected;if(!n||e.data.id!==n.dataset.cmsId)return;var prop=e.data.prop,value=typeof e.data.value==="string"?e.data.value:"";if(value.length>100000)return;if(prop==="textContent"&&n.children.length===0)n.textContent=value;else if(prop==="href"&&n instanceof HTMLAnchorElement&&/^(https?:|\\/|#)/i.test(value))n.href=value;else if(prop==="src"&&n instanceof HTMLImageElement&&/^(https?:|\\/|data:image\\/)/i.test(value))n.src=value;else if(prop.indexOf("style.")===0&&allowedStyle[prop.slice(6)])n.style.setProperty(prop.slice(6),value);else return;parent.postMessage({source:"cms-builder-dom-mutation",id:n.dataset.cmsId,blockId:blockId(n.dataset.cmsId),prop:prop,value:value},origin());send("cms-builder",n)},false);window.addEventListener("scroll",function(){if(selected)send("cms-builder",selected)},true);window.addEventListener("resize",function(){if(selected)send("cms-builder",selected)});})();</script>`;
}

const PROPERTY_KEYS: Record<string, string[]> = {
  storefront_header: ["editorHref"],
  header_navigation: ["editorHref"],
  header_actions: ["editorHref"],
  storefront_footer: ["editorHref"],
  footer_columns: ["editorHref"],
  hero: ["title", "subtitle", "imageUrl", "mediaType", "videoUrl", "href", "ctaLabel"],
  rich_text: ["html"],
  image: ["src", "alt"],
  two_column: ["html", "imageUrl", "imageAlt", "reverse"],
  cta_row: ["label", "href"],
  trust_strip: [
    "col1Title",
    "col1Body",
    "col2Title",
    "col2Body",
    "col3Title",
    "col3Body",
  ],
  contact_strip: ["phone", "email", "hours"],
  newsletter: ["heading", "subtitle", "actionUrl"],
  featured_products: ["slugs"],
  home_tiles: ["tiles"],
  latest_section: ["title", "viewAllLabel", "viewAllHref"],
  faq: ["items"],
  video: ["url", "title"],
  divider: ["heightPx"],
};

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
  switch (block.type) {
    case "hero":
      return [
        child("image", "Hero image", "imageUrl"),
        child("eyebrow", "Eyebrow"),
        child("title", "Headline", "title"),
        child("subtitle", "Supporting text", "subtitle"),
        child("cta", "Primary action", "ctaLabel"),
        child("partners", "Partner marquee"),
      ];
    case "home_tiles":
      return [
        child("grid", "Tile grid", "tiles"),
        ...[0, 1, 2].map((index) =>
          child(`tile-${index}`, `Category tile ${index + 1}`, "tiles", index),
        ),
      ];
    case "latest_section":
      return [
        child("header", "Section heading", "title"),
        child("products", "Product grid"),
      ];
    case "newsletter":
      return [
        child("heading", "Signup heading", "heading"),
        child("form", "Signup form", "actionUrl"),
      ];
    case "rich_text":
      return [child("content", "Text content", "html")];
    case "image":
      return [
        child("media", "Image", "src"),
        child("caption", "Caption", "alt"),
      ];
    case "two_column":
      return [
        child("content", "Text content", "html"),
        child("media", "Image", "imageUrl"),
      ];
    case "cta_row":
      return [child("action", "Action", "label")];
    case "trust_strip":
      return [1, 2, 3].flatMap((index) => [
        child(`column-${index}`, `Trust point ${index}`, `col${index}Title`),
        child(`column-${index}-body`, `Trust point ${index} body`, `col${index}Body`),
      ]);
    case "contact_strip":
      return [
        child("phone", "Phone", "phone"),
        child("email", "Email", "email"),
        child("hours", "Business hours", "hours"),
      ];
    case "featured_products":
      return [
        child("heading", "Section heading"),
        child("grid", "Product grid", "slugs"),
      ];
    case "faq":
      return (Array.isArray(block.props.items) ? block.props.items : [])
        .slice(0, 6)
        .flatMap((_, index) => [
          child(`question-${index}`, `Question ${index + 1}`, "items", index),
          child(`answer-${index}`, `Answer ${index + 1}`, "items", index),
        ]);
    case "video":
      return [
        child("player", "Video player", "url"),
        child("title", "Video title", "title"),
      ];
    case "divider":
      return [child("spacer", "Spacer", "heightPx")];
    case "payment_link":
      return [
        child("provider", "Payment provider"),
        child("title", "Payment title"),
        child("description", "Payment description"),
        child("action", "Payment action"),
      ];
    case "header_navigation":
    case "header_actions":
    case "storefront_header":
    case "storefront_footer":
    case "footer_columns":
      return [];
    default:
      return [];
  }
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
}: {
  nodes: ComponentNode[];
  selectedId: string | null;
  onSelect: (_node: ComponentNode) => void;
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={`flex min-h-7 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${selectedId === node.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            style={{ paddingLeft: `${8 + node.depth * 16}px` }}
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
          {node.children?.length ? (
            <ComponentTree
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
            />
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
}: {
  block: CmsBlock;
  disabled: boolean;
  onChange: (_layout: Record<string, unknown>) => void;
}) {
  const layout =
    block.props.layout && typeof block.props.layout === "object"
      ? (block.props.layout as Record<string, unknown>)
      : {};
  const fields = [
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
  ] as const;
  return (
    <details className="rounded border border-slate-200" open>
      <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-slate-600">
        Layout
      </summary>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-2.5">
        {fields.map(([key, label]) => (
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
      </div>
    </details>
  );
}

function BlockPropertyFields({
  block,
  disabled,
  onChange,
  focus,
  onPickMedia,
}: {
  block: CmsBlock;
  disabled: boolean;
  onChange: (_key: string, _value: unknown) => void;
  focus?: Pick<ComponentNode, "propertyKey" | "arrayIndex">;
  onPickMedia?: (_key: string) => void;
}) {
  const keys = focus?.propertyKey
    ? [focus.propertyKey]
    : (PROPERTY_KEYS[block.type] ?? []);
  if (!keys.length)
    return (
      <p className="text-xs text-slate-500">
        This custom block has no typed controls. Use the structured settings below.
      </p>
    );
  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const rawValue = block.props[key];
        const value =
          focus?.arrayIndex !== undefined && Array.isArray(rawValue)
            ? rawValue[focus.arrayIndex]
            : rawValue;
        if (focus?.arrayIndex !== undefined && Array.isArray(rawValue))
          return (() => {
            const arrayIndex = focus.arrayIndex;
            const item = rawValue[arrayIndex];
            if (key === "tiles" && item && typeof item === "object" && !Array.isArray(item)) {
              const tile = item as Record<string, unknown>;
              return (
                <div key={key} className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Category tile {arrayIndex + 1}</p>
                  {(["title", "subtitle", "linkLabel", "href"] as const).map((field) => (
                    <label key={field} className="block text-[11px] text-slate-500">
                      {propertyLabel(field)}
                      <input
                        className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        value={text(tile[field])}
                        onChange={(event) => {
                          const next = [...rawValue];
                          next[arrayIndex] = { ...tile, [field]: event.target.value };
                          onChange(key, next);
                        }}
                        disabled={disabled}
                      />
                    </label>
                  ))}
                  <label className="block text-[11px] text-slate-500">
                    Background image URL
                    <input
                      className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                      value={text(tile.imageUrl)}
                      onChange={(event) => {
                        const next = [...rawValue];
                        next[arrayIndex] = { ...tile, imageUrl: event.target.value };
                        onChange(key, next);
                      }}
                      disabled={disabled}
                      placeholder="https://..."
                    />
                  </label>
                  {onPickMedia ? (
                    <button type="button" className="h-8 w-full rounded border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50" onClick={() => onPickMedia(`tiles:${arrayIndex}`)} disabled={disabled}>
                      Choose from catalog media
                    </button>
                  ) : null}
                </div>
              );
            }
            return (
              <label key={key} className="block text-[11px] text-slate-500">
                {propertyLabel(key)}
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
              {propertyLabel(key)}
            </label>
          );
        if (Array.isArray(value))
          return (
            <label key={key} className="block text-[11px] text-slate-500">
              {propertyLabel(key)}
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
              Hero media type
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
            {propertyLabel(key)}
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
            {onPickMedia && (key === "imageUrl" || key === "videoUrl" || key === "src") ? (
              <button type="button" className="mt-1 h-8 w-full rounded border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50" onClick={() => onPickMedia(key)} disabled={disabled}>
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

function CmsToolSurface({ tool }: { tool: CmsToolId }) {
  const surfaces: Record<CmsToolId, ReactNode> = {
    pages: <CmsPagesManager />,
    "site-map": <CmsSiteMapPanel />,
    navigation: <CmsNavigationEditor />,
    announcement: <CmsAnnouncementEditor />,
    categories: <CmsCategoryEditor />,
    media: <CmsMediaManager />,
    blog: <CmsBlogManager />,
    forms: <CmsFormsTable />,
    redirects: <CmsRedirectsManager />,
    experiments: <CmsExperimentsManager />,
    commerce: <CmsCommerceSearch />,
  };
  return (
    <div className="mx-auto w-full max-w-6xl rounded-xl bg-background p-4 shadow-xl ring-1 ring-foreground/10 sm:p-6">
      {surfaces[tool]}
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
  pageTitle,
  pageBody,
  onPageBodyChange,
  settings,
  toolbarActions,
  onClose,
  immersive = false,
  previewMode = "page",
}: {
  value: unknown;
  onChange: (_blocks: CmsBlock[]) => void;
  disabled: boolean;
  previewUrl?: string;
  pages?: BuilderPage[];
  currentPageId?: string;
  onSelectPage?: (_id: string) => void;
  onNewPage?: () => void;
  pageTitle?: string;
  pageBody?: string;
  onPageBodyChange?: (_body: string) => void;
  settings?: ReactNode;
  toolbarActions?: ReactNode;
  onClose?: () => void;
  immersive?: boolean;
  previewMode?: "home" | "page";
}) {
  const blocks = useMemo(() => normalize(value), [value]);
  const [selectedId, setSelectedId] = useState<string | null>(
    blocks[0]?.id ?? null,
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    blocks[0]?.id ?? null,
  );
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<"pages" | "components" | "layers">(
    "pages",
  );
  const [activeTool, setActiveTool] = useState<CmsToolId | null>(null);
  const [builderMode, setBuilderMode] = useState<"instance" | "canvas">(
    "instance",
  );
  const [componentCanvasId, setComponentCanvasId] = useState<string | null>(
    null,
  );
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [rightTab, setRightTab] = useState<
    "content" | "style" | "advanced" | "code" | "settings"
  >(
    "content",
  );
  const [history, setHistory] = useState<CmsBlock[][]>([]);
  const [future, setFuture] = useState<CmsBlock[][]>([]);
  const [presets, setPresets] = useState<CmsPageBlockPresetRow[]>([]);
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<string | null>(null);
  const [propsDraft, setPropsDraft] = useState("");
  const [componentDefinitions, setComponentDefinitions] = useState<CmsComponentDefinition[]>(
    () => listCmsComponentDefinitions(),
  );
  const [componentVersions, setComponentVersions] = useState<Record<string, number>>({});
  const [canvasDraft, setCanvasDraft] = useState("");
  const [canvasSavePending, setCanvasSavePending] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState<PreviewTarget | null>(
    null,
  );
  const [selectedPreview, setSelectedPreview] = useState<PreviewTarget | null>(
    null,
  );
  const rawPreviewRef = useRef<PreviewTarget | null>(null);
  const rawHoveredPreviewRef = useRef<PreviewTarget | null>(null);
  const selectedMessageKeyRef = useRef("");
  const sendDraftRef = useRef<(() => void) | null>(null);
  const previewReadyRef = useRef(false);
  const remeasureFrameRef = useRef<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasScrollRef = useRef<HTMLElement>(null);
  const componentTree = useMemo(() => buildComponentTree(blocks), [blocks]);
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
  const selectedEditorBlock = useMemo(
    () =>
      selected && selectedInstance
        ? {
            ...selected,
            id: selectedInstance.id,
            componentId: selectedInstance.componentId,
            variantId: selectedInstance.variantId,
            props: selectedInstance.props,
            slots: selectedInstance.slots,
          }
        : selected,
    [selected, selectedInstance],
  );
  const selectedPreviewFocus = useMemo<ComponentNode | undefined>(() => {
    if (
      !selectedPreview?.propertyKey ||
      selectedPreview.arrayIndex === null ||
      selectedPreview.arrayIndex === undefined ||
      !selected
    ) {
      return undefined;
    }
    return {
      id: selectedPreview.parentId ?? selectedPreview.id,
      label: selectedPreview.label,
      blockId: selected.id,
      depth: 1,
      propertyKey: selectedPreview.propertyKey,
      arrayIndex: selectedPreview.arrayIndex,
    };
  }, [selected, selectedPreview]);
  useEffect(() => {
    setSelectedPreview((current) =>
      current && current.id === selectedComponentId ? current : null,
    );
  }, [selectedComponentId]);
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
  const selectedDefinition = useMemo<CmsComponentDefinition | undefined>(() => {
    const id =
      selectedEditorBlock?.componentId ??
      selectedEditorBlock?.type.replaceAll("_", "-");
    return componentDefinitions.find((definition) => definition.id === id);
  }, [componentDefinitions, selectedEditorBlock]);
  const canvasDefinition = componentDefinitions.find(
    (definition) => definition.id === componentCanvasId,
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/cms/components", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          data?: CmsComponentDefinition[];
          meta?: { records?: Array<{ id: string; version: number }> };
        } | null;
        if (!response.ok || !payload?.data?.length) return;
        setComponentDefinitions(payload.data);
        setComponentVersions(
          Object.fromEntries(
            (payload.meta?.records ?? []).map((record) => [record.id, record.version]),
          ),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setCanvasDraft(canvasDefinition ? JSON.stringify(canvasDefinition, null, 2) : "");
  }, [canvasDefinition]);
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
      setMessage("Component definition is invalid. Check required fields and variants.");
      return;
    }
    setCanvasSavePending(true);
    try {
      const response = await fetch("/api/admin/cms/components", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${parsed.data.id}`,
        },
        body: JSON.stringify({
          definition: parsed.data,
          ...(componentVersions[parsed.data.id]
            ? { expectedVersion: componentVersions[parsed.data.id] }
            : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          definition?: CmsComponentDefinition;
          component_key?: string;
          version?: number;
        };
      } | null;
      if (!response.ok || !payload?.data?.definition) {
        setMessage(response.status === 409 ? "Definition changed elsewhere. Reload before saving." : "Unable to save component definition.");
        return;
      }
      const saved = payload.data.definition;
      setComponentDefinitions((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved],
      );
      setComponentVersions((current) => ({
        ...current,
        [saved.id]: payload.data?.version ?? (current[saved.id] ?? 0) + 1,
      }));
      setCanvasDraft(JSON.stringify(saved, null, 2));
      setMessage("Main component saved.");
    } finally {
      setCanvasSavePending(false);
    }
  }, [canvasDraft, componentVersions]);

  const commit = useCallback(
    (next: CmsBlock[], select?: string) => {
      setHistory((current) => [...current.slice(-19), blocks]);
      setFuture([]);
      onChange(next);
      if (select) {
        setSelectedId(select);
        setSelectedComponentId(select);
      }
    },
    [blocks, onChange],
  );
  useEffect(() => {
    if (!selectedId || !blocks.some((b) => b.id === selectedId)) {
      const next = blocks[0]?.id ?? null;
      setSelectedId(next);
      setSelectedComponentId(next);
    }
    if (
      selectedComponentId &&
      !selectedComponentId.startsWith("cms-dom-") &&
      !componentNodes.some((node) => node.id === selectedComponentId)
    ) {
      setSelectedComponentId(selectedId ?? blocks[0]?.id ?? null);
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
    void fetch("/api/admin/cms/block-presets").then(async (r) => {
      const j = (await r.json()) as { data?: CmsPageBlockPresetRow[] };
      if (r.ok) setPresets(j.data ?? []);
    });
  }, []);
  const documentHtml = useMemo(
    () =>
      canvasDocument(pageBody ?? "", blocks).replace(
        "</body></html>",
        `${canvasEditorRuntime(blocks)}</body></html>`,
      ),
    [blocks, pageBody],
  );
  const previewOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!previewUrl) return window.location.origin;
    try {
      return new URL(previewUrl, window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  }, [previewUrl]);
  const sendDomMutation = (property: string, value: string) => {
    const target = selectedPreview;
    if (!target || (!target.id.startsWith("cms-dom-") && !target.id.includes("::"))) return;
    iframeRef.current?.contentWindow?.postMessage(
      { source: "cms-builder-dom-edit", id: target.id, prop: property, value },
      previewOrigin,
    );
  };
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
      const scale = zoom / 100;
      const frameScaleX = frame.clientWidth
        ? frameRect.width / frame.clientWidth
        : scale;
      const frameScaleY = frame.clientHeight
        ? frameRect.height / frame.clientHeight
        : scale;
      return {
        x:
          (frameRect.left - canvasRect.left) / scale +
          (rect.x * frameScaleX) / scale,
        y:
          (frameRect.top - canvasRect.top) / scale +
          (rect.y * frameScaleY) / scale,
        width: (rect.width * frameScaleX) / scale,
        height: (rect.height * frameScaleY) / scale,
      };
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
        parentId?: string | null;
        propertyKey?: string | null;
        arrayIndex?: number | null;
      }>,
    ) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      if (!previewOrigin || event.origin !== previewOrigin) return;
      const { source, id, blockId, rect, label } = event.data ?? {};
      if (source === "cms-preview-ready") {
        previewReadyRef.current = true;
        sendDraftRef.current?.();
        return;
      }
      if (source === "cms-builder-mutation") {
        const property = typeof event.data?.prop === "string" ? event.data.prop : "";
        const value = typeof event.data?.value === "string" ? event.data.value : "";
        if (!id || !property || property.length > 80 || value.length > 100_000) return;
        const next = applyPreviewMutation(blocks, id, property, value);
        if (next !== blocks) {
          commit(next, id.split("::", 1)[0]);
          setMessage("Canvas change recorded.");
        }
        return;
      }
      if (source === "cms-builder-dom-mutation") {
        const property = typeof event.data?.prop === "string" ? event.data.prop : "";
        const value = typeof event.data?.value === "string" ? event.data.value : "";
        if (!id || !blockId || !property || value.length > 100_000) return;
        const next = applyDomMutation(blocks, blockId, id, property, value);
        if (next !== blocks) {
          commit(next, blockId);
          setMessage("Live element change recorded.");
        }
        return;
      }
      if (source === "cms-builder-hover") {
        if (!id || !rect) {
          rawHoveredPreviewRef.current = null;
          setHoveredPreview((current) => (current ? null : current));
          return;
        }
        const target = { id, label: label ?? id, rect, tagName: event.data.tagName, text: event.data.text, href: event.data.href, src: event.data.src, style: event.data.style, parentId: event.data.parentId, propertyKey: event.data.propertyKey, arrayIndex: event.data.arrayIndex };
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
        const target = { id, label: label ?? id, rect, tagName: event.data.tagName, text: event.data.text, href: event.data.href, src: event.data.src, style: event.data.style, parentId: event.data.parentId, propertyKey: event.data.propertyKey, arrayIndex: event.data.arrayIndex };
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
      const component = componentNodes.find((node) => node.id === id);
      const resolvedBlockId =
        blockId && blocks.some((block) => block.id === blockId)
          ? blockId
          :
        component?.blockId ??
        (blocks.some((block) => block.id === id) ? id : null);
      if (!resolvedBlockId) return;
      setSelectedId((current) => (current === resolvedBlockId ? current : resolvedBlockId));
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
    return () => {
      if (remeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(remeasureFrameRef.current);
        remeasureFrameRef.current = null;
      }
      window.removeEventListener("message", onMessage);
      scrollContainer?.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, [blocks, commit, componentNodes, previewOrigin, zoom]);
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !previewUrl) return;
    const sendDraft = () => {
      if (!previewReadyRef.current) return;
      frame.contentWindow?.postMessage(
        {
          source: "cms-builder-draft",
          mode: previewMode,
          pageBody: pageBody ?? "",
          blocks,
        },
        previewOrigin,
      );
      if (selectedId) {
        frame.contentWindow?.postMessage(
          {
            source: "cms-builder-select",
            id: selectedComponentId ?? selectedId,
          },
          previewOrigin,
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
  const addBlock = (type: string) => {
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
        ...defaults(type),
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
  };
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
        ...defaults(type),
        ...definition.props.reduce<Record<string, unknown>>((acc, item) => {
          if (item.defaultValue !== undefined) acc[item.key] = item.defaultValue;
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
  const addInstanceToSlot = (slotName: string, componentId: string) => {
    if (!selected || selectedDefinition?.id !== selectedEditorBlock?.componentId) {
      setMessage("Select the matching component instance before adding a slot item.");
      return;
    }
    const definition = componentDefinitions.find((item) => item.id === componentId);
    if (!definition) return;
    const type = definition.id.replaceAll("-", "_");
    const child = componentInstanceFromBlock({
      id: makeId(),
      type,
      componentId: definition.id,
      variantId: definition.defaultVariantId,
      props: {
        ...defaults(type),
        ...definition.props.reduce<Record<string, unknown>>((acc, item) => {
          if (item.defaultValue !== undefined) acc[item.key] = item.defaultValue;
          return acc;
        }, {}),
      },
      slots: definition.slots.length ? {} : undefined,
    });
    const update = (instance: CmsComponentInstance): CmsComponentInstance => ({
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
            updateComponentInstances(items, selectedInstance.id, update) ?? [],
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
    );
    setMessage(`${definition.name} added to ${slotName}.`);
  };
  const updateSelectedSlot = (
    slotName: string,
    update: (_items: CmsComponentInstance[]) => CmsComponentInstance[],
  ) => {
    if (!selected) return;
    const updateOwner = (owner: CmsComponentInstance): CmsComponentInstance => ({
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
            updateComponentInstances(
              items,
              selectedInstance.id,
              (instance) => updateOwner(instance),
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
    );
  };
  const removeInstanceFromSlot = (slotName: string, index: number) => {
    updateSelectedSlot(slotName, (items) => items.filter((_, itemIndex) => itemIndex !== index));
    setMessage("Slot item removed.");
  };
  const moveInstanceInSlot = (slotName: string, index: number, delta: number) => {
    updateSelectedSlot(slotName, (items) => {
      const target = index + delta;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setMessage("Slot order updated.");
  };
  const updateSelected = (props: Record<string, unknown>) => {
    if (!selected) return;
    if (selectedInstance) {
      const slots = Object.fromEntries(
        Object.entries(selected.slots ?? {}).map(([slot, items]) => [
          slot,
          updateComponentInstances(items, selectedInstance.id, (instance) => ({
            ...instance,
            props,
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

  const applyPickedMedia = useCallback((urls: string[]) => {
    const url = urls[0]?.trim();
    const block = selectedEditorBlock;
    if (!url || !block || mediaPickerTarget === null) return;
    if (mediaPickerTarget.startsWith("tiles:")) {
      const index = Number(mediaPickerTarget.slice("tiles:".length));
      const tiles = Array.isArray(block.props.tiles) ? [...block.props.tiles] : [];
      const tile = tiles[index];
      if (tile && typeof tile === "object" && !Array.isArray(tile)) {
        tiles[index] = { ...(tile as Record<string, unknown>), imageUrl: url };
        updateSelected({ ...block.props, tiles });
      }
    } else {
      updateSelected({ ...block.props, [mediaPickerTarget]: url });
    }
    setMediaPickerTarget(null);
    setMessage("Media selected from the shared catalog library.");
  }, [mediaPickerTarget, selectedEditorBlock]);
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
    const appended = preset.blocks
      .filter((b) => !FIXED_COMPONENT_TYPES.has(b.type))
      .map((b) => ({
        ...b,
        id: makeId(),
        props: { ...b.props },
      }));
    commit([...blocks, ...appended], appended[0]?.id);
  };
  const savePreset = async () => {
    if (!presetName.trim() || !blocks.length) {
      setMessage("Enter a name and add at least one block.");
      return;
    }
    const r = await fetch("/api/admin/cms/block-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        ...defaults(type),
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
  const canvasWidth =
    device === "desktop"
      ? "min(100%, 1450px)"
      : device === "tablet"
        ? "768px"
        : "390px";

  const surface = (
    <section
      ref={surfaceRef}
      className={`${immersive && !fullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "relative min-h-[760px] rounded-xl"} flex flex-col overflow-hidden border border-slate-200 bg-slate-100 text-slate-700 shadow-2xl`}
      aria-label="Visual page builder"
    >
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 text-slate-500">
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100"
          onClick={() => setLeftOpen((v) => !v)}
          aria-label="Toggle left panel"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100"
          onClick={() => setRightOpen((v) => !v)}
          aria-label="Toggle right panel"
        >
          <PanelRight className="size-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100 disabled:opacity-30"
          onClick={() => {
            const old = history.at(-1);
            if (old) {
              setHistory((h) => h.slice(0, -1));
              setFuture((f) => [...f, blocks]);
              onChange(old);
            }
          }}
          disabled={disabled || !history.length}
          aria-label="Undo"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded hover:bg-slate-100 disabled:opacity-30"
          onClick={() => {
            const next = future.at(-1);
            if (next) {
              setFuture((f) => f.slice(0, -1));
              setHistory((h) => [...h, blocks]);
              onChange(next);
            }
          }}
          disabled={disabled || !future.length}
          aria-label="Redo"
        >
          <Redo2 className="size-4" />
        </button>
        <div className="ml-2 hidden min-w-0 items-center gap-2 text-xs font-medium text-slate-700 sm:flex">
          <span className="grid size-6 place-items-center rounded bg-slate-100">
            <Layers3 className="size-3.5" />
          </span>
          <span className="max-w-48 truncate">
            {pageTitle || "Page editor"}
          </span>
        </div>
        <div
          className="ml-3 flex items-center rounded border border-slate-200 bg-slate-50 p-0.5"
          aria-label="Builder surface"
        >
          <button
            type="button"
            className={`rounded px-2 py-1 text-[10px] ${builderMode === "instance" ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}
            onClick={() => setBuilderMode("instance")}
          >
            In context
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-[10px] ${builderMode === "canvas" ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}
            onClick={() => {
              setBuilderMode("canvas");
              setLeftTab("components");
            }}
          >
            Component canvas
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1 border-l border-slate-200 pl-2">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => setDevice(name)}
              className={`grid size-8 place-items-center rounded hover:bg-slate-100 ${device === name ? "bg-slate-100 text-slate-900" : ""}`}
              aria-label={`${name} viewport`}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-slate-100"
            onClick={() => setZoom((v) => Math.max(50, v - 10))}
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
            onClick={() => setZoom((v) => Math.min(150, v + 10))}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </button>
          {previewUrl ? (
            <button
              type="button"
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-100"
              onClick={() => {
                const safePreviewUrl = sanitizeTrustedPublicUrl(previewUrl);
                if (safePreviewUrl)
                  window.open(safePreviewUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Eye className="size-3.5" /> Preview
            </button>
          ) : null}
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-slate-100"
            onClick={() => void toggleFullscreen()}
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-3.5" />
          </button>
          {toolbarActions}
          <button
            type="button"
            className="ml-1 h-8 rounded border border-slate-200 px-3 text-xs hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3">
          <span className="grid size-7 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            CMS
          </span>
          <span className="my-1 h-px w-5 bg-slate-200" />
          {[PanelLeft, Layers3, FilePlus2].map((Icon, i) => (
            <button
              key={i}
              type="button"
              className={`grid size-8 place-items-center rounded hover:bg-slate-100 ${i === 0 ? "bg-slate-100 text-slate-900" : "text-slate-400"}`}
              onClick={() => {
                if (i === 0) setLeftOpen(true);
                if (i === 1) setLeftTab("layers");
                if (i === 2) onNewPage?.();
              }}
              aria-label={
                i === 0 ? "Open pages" : i === 1 ? "Open navigator" : "Add page"
              }
            >
              <Icon className="size-4" />
            </button>
          ))}
        </nav>
        {leftOpen ? (
          <aside className="z-30 flex w-[290px] shrink-0 flex-col border-r border-slate-200 bg-white max-sm:absolute max-sm:left-10 max-sm:top-11 max-sm:bottom-0 max-sm:w-[min(290px,calc(100vw-40px))] max-sm:shadow-xl">
            <div className="flex h-12 items-center gap-1 border-b border-slate-200 px-3">
              {(
                [
                  ["pages", "Pages"],
                  ["components", "Components"],
                  ["layers", "Navigator"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLeftTab(key)}
                  className={`rounded px-2 py-1.5 text-[11px] ${leftTab === key ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {leftTab === "pages" ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Project pages
                    </p>
                    <button
                      type="button"
                      onClick={onNewPage}
                      className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                      aria-label="Add page"
                    >
                      Add page <Plus className="size-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {pages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => onSelectPage?.(page.id)}
                        className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs ${page.id === currentPageId ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                      >
                        <span className="min-w-0 truncate">
                          {page.title || page.slug}
                        </span>
                        <span className="ml-2 text-[10px] text-slate-400">
                          {page.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {leftTab === "layers" ? (
                <>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Navigator
                  </p>
                  <ComponentTree
                    nodes={componentTree}
                    selectedId={selectedComponentId}
                    onSelect={(node) => {
                      setSelectedId(node.blockId);
                      setSelectedComponentId(node.id);
                      setRightTab("content");
                      setRightOpen(true);
                    }}
                  />
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      CMS surfaces
                    </p>
                    <div className="space-y-1">
                      {[
                        ["pages", "Pages"],
                        ["site-map", "Site map"],
                        ["navigation", "Navigation"],
                        ["announcement", "Announcement"],
                        ["categories", "Categories"],
                        ["media", "Media"],
                        ["blog", "Blog"],
                        ["forms", "Forms"],
                        ["redirects", "Redirects"],
                        ["experiments", "Experiments"],
                        ["commerce", "Product lookup"],
                      ].map(([tool, label]) => (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => setActiveTool(tool as CmsToolId)}
                          className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs ${activeTool === tool ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                        >
                          {label}
                          <ChevronRight className="size-3 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              {leftTab === "components" ? (
                <>
                  <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Main components
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {componentDefinitions.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {componentDefinitions.map((definition) => (
                        <div
                          key={definition.id}
                          className="flex items-center gap-1.5 rounded bg-white px-2 py-1.5 ring-1 ring-slate-200/80"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => {
                              setComponentCanvasId(definition.id);
                              setBuilderMode("canvas");
                            }}
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
                              addBlock(definition.id.replaceAll("-", "_"))
                            }
                            aria-label={`Add ${definition.name}`}
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {Object.entries(grouped).map(([group, items]) => (
                    <div key={group} className="mb-5">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {group}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {items
                          .filter(
                            (item) => !FIXED_COMPONENT_TYPES.has(item.type),
                          )
                          .map((item) => (
                            <button
                              key={item.type}
                              type="button"
                              disabled={disabled}
                              onClick={() => addBlock(item.type)}
                              draggable={!disabled}
                              onDragStart={(event) =>
                                event.dataTransfer.setData(
                                  "application/x-cms-block",
                                  item.type,
                                )
                              }
                              className="rounded border border-slate-200 bg-white px-2 py-2.5 text-left text-[11px] text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <Plus className="mb-1 size-3 text-slate-400" />
                              {item.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
              {leftTab === "components" ? (
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Presets
                  </p>
                  <select
                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-600"
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value)}
                  >
                    <option value="">Select preset</option>
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
                    Add preset
                  </button>
                  <input
                    className="mt-3 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="New preset name"
                  />
                  <button
                    type="button"
                    className="mt-2 h-8 w-full rounded bg-primary text-xs font-medium text-primary-foreground"
                    onClick={() => void savePreset()}
                    disabled={disabled}
                  >
                    Save as preset
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">CMS workspace</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">Content tool</p>
                </div>
                <button type="button" className="h-8 rounded border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50" onClick={() => setActiveTool(null)}>
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
                          </div>
                        ))}
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
                              {selectedEditorBlock?.componentId === canvasDefinition.id ? (
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
                                        addInstanceToSlot(slot.name, componentId)
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
                          Edit the reusable structure, props, slots, variants, and tokens. Changes apply to future instances.
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
                    </div>
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
                        <div
                          className="pointer-events-none origin-top-left scale-[.82] rounded border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm"
                          dangerouslySetInnerHTML={{
                            __html: blockHtml({
                              id: `canvas-${canvasDefinition.id}-${variant.id}`,
                              type: canvasDefinition.id.replaceAll("-", "_"),
                              componentId: canvasDefinition.id,
                              variantId: variant.id,
                              props: {
                                ...canvasDefinition.props.reduce<Record<string, unknown>>(
                                  (acc, item) => {
                                    if (item.defaultValue !== undefined) acc[item.key] = item.defaultValue;
                                    return acc;
                                  },
                                  {},
                                ),
                                ...(variant.props ?? {}),
                              },
                              slots: {},
                            }),
                          }}
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
                    src={previewUrl}
                    srcDoc={previewUrl ? undefined : documentHtml}
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
                  {selectedPreview ? (
                    <div
                      className="pointer-events-none absolute z-10 border-2 border-blue-600 bg-blue-500/5 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
                      style={{
                        left: selectedPreview.rect.x,
                        top: selectedPreview.rect.y,
                        width: selectedPreview.rect.width,
                        height: selectedPreview.rect.height,
                      }}
                    >
                      <span className="absolute -top-6 left-0 rounded bg-blue-600 px-1.5 py-1 text-[10px] font-medium leading-none text-white shadow-sm">
                        {selectedPreview.label}
                      </span>
                    </div>
                  ) : null}
                  {!hoveredPreview && !selectedPreview ? (
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
          <aside className="z-30 w-[310px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white max-sm:absolute max-sm:right-0 max-sm:top-11 max-sm:bottom-0 max-sm:w-[min(310px,calc(100vw-40px))] max-sm:shadow-xl">
            <div className="flex h-12 items-center gap-1 border-b border-slate-200 px-3">
              <button
                type="button"
                onClick={() => setRightTab("content")}
              className={`rounded px-2.5 py-1.5 text-[11px] ${rightTab === "content" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
            >
                Content
              </button>
              <button
                type="button"
                onClick={() => setRightTab("style")}
                className={`rounded px-2.5 py-1.5 text-[11px] ${rightTab === "style" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                Style
              </button>
              <button
                type="button"
                onClick={() => setRightTab("advanced")}
                className={`rounded px-2.5 py-1.5 text-[11px] ${rightTab === "advanced" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                Advanced
              </button>
              <button
                type="button"
                onClick={() => setRightTab("code")}
                className={`rounded px-2.5 py-1.5 text-[11px] ${rightTab === "code" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                Code
              </button>
              <button
                type="button"
                onClick={() => setRightTab("settings")}
                className={`rounded px-2.5 py-1.5 text-[11px] ${rightTab === "settings" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
              >
                Page settings
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
            {rightTab === "settings" ? (
              <div className="p-4">{settings}</div>
            ) : rightTab === "code" ? (
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-medium text-slate-700">Page body</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    This source is sanitized before storefront rendering. Save after editing to publish the page body.
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
                    Homepage content is managed by structured components and has no raw page body.
                  </p>
                )}
              </div>
            ) : selected ? (
              <div className="space-y-4 p-4">
                {selectedPreview?.id.startsWith("cms-dom-") ? (
                  <div
                    key={selectedPreview.id}
                    className="space-y-3 rounded border border-blue-200 bg-blue-50/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                          Live DOM element
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-slate-700">
                          {selectedPreview.tagName ?? "element"}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400">{selectedPreview.id}</span>
                    </div>
                    {selectedPreview.text ? (
                      <label className="block text-[10px] text-slate-600">
                        Content
                        <textarea
                          defaultValue={selectedPreview.text}
                          className="mt-1 min-h-16 w-full resize-y rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                          disabled={disabled}
                          onBlur={(event) => sendDomMutation("textContent", event.target.value)}
                        />
                      </label>
                    ) : null}
                    {selectedPreview.href ? (
                      <label className="block text-[10px] text-slate-600">
                        Link URL
                        <input
                          defaultValue={selectedPreview.href}
                          className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                          disabled={disabled}
                          onBlur={(event) => sendDomMutation("href", event.target.value)}
                        />
                      </label>
                    ) : null}
                    {selectedPreview.src ? (
                      <label className="block text-[10px] text-slate-600">
                        Image URL
                        <input
                          defaultValue={selectedPreview.src}
                          className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                          disabled={disabled}
                          onBlur={(event) => sendDomMutation("src", event.target.value)}
                        />
                      </label>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      {["width", "height", "margin", "padding", "color", "background-color", "font-size", "font-weight", "border-radius"].map((property) => (
                        <label key={property} className="block text-[10px] text-slate-600">
                          {property}
                          <input
                            defaultValue={selectedPreview.style?.[property] ?? ""}
                            className="mt-1 h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                            disabled={disabled}
                            onBlur={(event) => sendDomMutation(`style.${property}`, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] leading-4 text-slate-500">
                      Changes apply to this live storefront element and are recorded in the page history.
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
                      <button
                        type="button"
                        className="h-7 rounded border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => {
                          setComponentCanvasId(selectedDefinition.id);
                          setBuilderMode("canvas");
                        }}
                      >
                        Edit main
                      </button>
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
                          Boolean(selectedComponent?.fixed && !selectedInstance)
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
                              className="rounded border border-slate-200 bg-white p-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-medium text-slate-600">
                                  {slot.label}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {selectedEditorBlock?.slots?.[slot.name]?.length ?? 0}
                                </span>
                              </div>
                              <div className="mt-1 space-y-1">
                                {(selectedEditorBlock?.slots?.[slot.name] ?? []).map(
                                  (child, index) => {
                                    const childDefinition = componentDefinitions.find(
                                      (definition) => definition.id === child.componentId,
                                    );
                                    const childLabel = childDefinition?.name ?? child.componentId;
                                    const itemCount = selectedEditorBlock?.slots?.[slot.name]?.length ?? 0;
                                    return (
                                      <div
                                        key={child.id}
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
                                          onClick={() => moveInstanceInSlot(slot.name, index, -1)}
                                          disabled={disabled || index === 0}
                                          aria-label={`Move ${childLabel} up`}
                                        >
                                          <ChevronLeft className="size-3 rotate-90" />
                                        </button>
                                        <button
                                          type="button"
                                          className="grid size-5 place-items-center rounded text-slate-500 hover:bg-white disabled:opacity-30"
                                          onClick={() => moveInstanceInSlot(slot.name, index, 1)}
                                          disabled={disabled || index === itemCount - 1}
                                          aria-label={`Move ${childLabel} down`}
                                        >
                                          <ChevronRight className="size-3 rotate-90" />
                                        </button>
                                        <button
                                          type="button"
                                          className="grid size-5 place-items-center rounded text-red-500 hover:bg-red-50"
                                          onClick={() => removeInstanceFromSlot(slot.name, index)}
                                          disabled={disabled}
                                          aria-label={`Remove ${childLabel}`}
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </div>
                                    );
                                  },
                                )}
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
                      component. This instance can change props, slots, and its
                      selected variant.
                    </p>
                  </div>
                ) : null}
                {rightTab === "content" ? (
                  <>
                    <BlockPropertyFields
                      block={selectedEditorBlock ?? selected}
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
                    {FIXED_COMPONENT_TYPES.has(selected.type) ? (
                      <a
                        href="/admin/cms/navigation"
                        className="flex h-9 items-center justify-center rounded border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Edit navigation and footer content
                      </a>
                    ) : null}
                  </>
                ) : null}
                {rightTab === "style" ? (
                  <LayoutFields
                    block={selectedEditorBlock ?? selected}
                    disabled={
                      disabled ||
                      Boolean(selectedComponent?.fixed && !selectedInstance)
                    }
                    onChange={(layout) =>
                      updateSelected({
                        ...(selectedEditorBlock?.props ?? {}),
                        layout,
                      })
                    }
                  />
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
              <div className="p-6 text-center text-xs leading-5 text-slate-500">
                Select an element on the canvas or in Navigator to edit it.
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
