import type {
  CmsBlock,
  CmsComponentDefinition,
  CmsComponentInstance,
} from "./cms-types.js";

const tokens = {
  radius: "var(--radius-card, 0.75rem)",
  surface: "var(--color-surface, #ffffff)",
  text: "var(--color-text, #0f172a)",
  muted: "var(--color-muted, #64748b)",
  space: "var(--space-section, 1.5rem)",
};

const prop = (
  key: string,
  label: string,
  type: CmsComponentDefinition["props"][number]["type"],
  defaultValue?: unknown,
 ) => ({ key, label, type, defaultValue, section: "content" as const });

const match = (tags: string[], classes: string[] = []) => ({ tags, classes });

const editorDefaults = {
  resizable: true,
  responsive: true,
  toolbar: ["move", "duplicate", "delete"],
};

export const CMS_COMPONENT_DEFINITIONS: CmsComponentDefinition[] = [
  {
    id: "storefront-header",
    name: "Storefront navbar",
    description: "Global storefront navigation, brand, and account actions.",
    category: "Global",
    version: 1,
    structure: "header > brand + navigation + actions",
    styleTokens: tokens,
    props: [prop("editorHref", "Content settings", "url", "/admin/cms/navigation")],
    slots: [
      { name: "navigation", label: "Navigation", allowedComponentIds: ["header-navigation"] },
      { name: "actions", label: "Actions", allowedComponentIds: ["header-actions"] },
    ],
    variants: [
      { id: "default", label: "Default" },
      { id: "compact", label: "Compact", styleTokens: { density: "compact" } },
    ],
    defaultVariantId: "default",
    isGlobal: true,
    match: match(["header"], ["sitebar"]),
    ...editorDefaults,
  },
  {
    id: "storefront-footer",
    name: "Storefront footer",
    description: "Global footer columns, support links, and social links.",
    category: "Global",
    version: 1,
    structure: "footer > brand + columns + social",
    styleTokens: tokens,
    props: [prop("editorHref", "Content settings", "url", "/admin/cms/navigation")],
    slots: [{ name: "columns", label: "Footer columns", multiple: true }],
    variants: [
      { id: "default", label: "Default" },
      { id: "minimal", label: "Minimal" },
    ],
    defaultVariantId: "default",
    isGlobal: true,
    match: match(["footer"], ["muted"]),
    ...editorDefaults,
  },
  {
    id: "hero",
    name: "Hero banner",
    description: "A headline, supporting copy, media, and primary action.",
    category: "Sections",
    version: 1,
    structure: "section > eyebrow + heading + paragraph + action",
    styleTokens: tokens,
    props: [
      prop("title", "Headline", "text", "New hero"),
      prop("subtitle", "Supporting text", "text", "Add a short introduction"),
      prop("imageUrl", "Background image", "image", ""),
      prop("href", "Action URL", "url", "/"),
      prop("ctaLabel", "Action label", "text", "Learn more"),
    ],
    slots: [{ name: "actions", label: "Actions", allowedComponentIds: ["cta-row"], multiple: true }],
    variants: [
      { id: "default", label: "Default" },
      { id: "compact", label: "Compact", props: { layout: { minHeight: "220px" } } },
      { id: "split", label: "Split", styleTokens: { layout: "split" } },
    ],
    defaultVariantId: "default",
    match: match(["section"], ["hero"]),
    ...editorDefaults,
  },
  {
    id: "cta-row",
    name: "Call to action",
    description: "A focused action link with selectable visual treatment.",
    category: "Content",
    version: 1,
    structure: "div > link",
    styleTokens: tokens,
    props: [prop("label", "Label", "text", "Continue"), prop("href", "URL", "url", "/")],
    slots: [],
    variants: [
      { id: "solid", label: "Solid" },
      { id: "outline", label: "Outline" },
    ],
    defaultVariantId: "solid",
    match: match(["a"], ["cta-row"]),
    ...editorDefaults,
  },
  {
    id: "two-column",
    name: "Two column section",
    description: "A responsive content and media composition.",
    category: "Sections",
    version: 1,
    structure: "section > content + media",
    styleTokens: tokens,
    props: [prop("html", "Content", "rich-text", "<p>Tell your story here.</p>"), prop("imageUrl", "Image", "image", ""), prop("imageAlt", "Image alt text", "text", ""), prop("reverse", "Reverse columns", "boolean", false)],
    slots: [{ name: "content", label: "Content" }, { name: "media", label: "Media" }],
    variants: [{ id: "default", label: "Default" }, { id: "reversed", label: "Reversed", props: { reverse: true } }],
    defaultVariantId: "default",
    match: match(["section"], ["two-column"]),
    ...editorDefaults,
  },
  {
    id: "newsletter",
    name: "Newsletter signup",
    description: "A reusable email capture section.",
    category: "Commerce",
    version: 1,
    structure: "section > heading + paragraph + form",
    styleTokens: tokens,
    props: [prop("heading", "Heading", "text", "Stay in the loop"), prop("subtitle", "Supporting text", "text", ""), prop("actionUrl", "Form URL", "url", "")],
    slots: [{ name: "form", label: "Signup form" }],
    variants: [{ id: "default", label: "Default" }, { id: "dark", label: "Dark", styleTokens: { surface: "#0f172a" } }],
    defaultVariantId: "default",
    match: match(["section"], ["newsletter"]),
    ...editorDefaults,
  },
  {
    id: "rich-text",
    name: "Rich text",
    description: "Semantic editorial content with safe HTML.",
    category: "Content",
    version: 1,
    structure: "article > rich text",
    styleTokens: tokens,
    props: [prop("html", "Content", "rich-text", "<p>Start writing...</p>")],
    slots: [],
    variants: [{ id: "default", label: "Default" }],
    defaultVariantId: "default",
    match: match(["article", "div"], ["rich-text"]),
    ...editorDefaults,
  },
];

const DEFINITION_BY_ID = new Map(CMS_COMPONENT_DEFINITIONS.map((definition) => [definition.id, definition]));

export function listCmsComponentDefinitions() {
  return CMS_COMPONENT_DEFINITIONS;
}

export function getCmsComponentDefinition(id: string | undefined) {
  if (!id) return undefined;
  return DEFINITION_BY_ID.get(id) ?? DEFINITION_BY_ID.get(id.replaceAll("_", "-"));
}

export function getCmsVariant(definition: CmsComponentDefinition | undefined, variantId?: string) {
  if (!definition) return undefined;
  return definition.variants.find((variant) => variant.id === (variantId ?? definition.defaultVariantId)) ?? definition.variants[0];
}

export function resolveCmsInstanceProps(instance: Pick<CmsComponentInstance, "componentId" | "variantId" | "props">) {
  const definition = getCmsComponentDefinition(instance.componentId);
  const variant = getCmsVariant(definition, instance.variantId);
  return { ...(variant?.props ?? {}), ...instance.props };
}

export function componentInstanceFromBlock(block: CmsBlock): CmsComponentInstance {
  return {
    id: block.id,
    componentId: block.componentId ?? block.type.replaceAll("_", "-"),
    variantId: block.variantId,
    props: block.props,
    slots: block.slots ?? {},
    styleOverrides: block.styleOverrides,
  };
}

export function blockFromComponentInstance(instance: CmsComponentInstance): CmsBlock {
  return {
    id: instance.id,
    type: instance.componentId.replaceAll("-", "_"),
    componentId: instance.componentId,
    variantId: instance.variantId,
    props: instance.props,
    slots: instance.slots,
    styleOverrides: instance.styleOverrides,
  };
}
