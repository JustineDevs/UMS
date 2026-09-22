import type {
  CmsBlock,
  CmsBlockDefinition,
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

const SAFE_STYLE_PROPERTIES = new Set([
  "display", "position", "width", "height", "min-width", "max-width",
  "min-height", "max-height", "margin", "padding", "color",
  "background-color", "background-size", "background-position", "font-family",
  "font-size", "font-weight", "line-height", "letter-spacing", "border",
  "border-radius", "box-shadow", "gap", "align-items", "justify-content",
  "grid-template-columns", "object-fit", "object-position",
]);

/** Shared allowlist for persisted style mutations and publish validation. */
export function isSafeCmsStyleKey(key: string): boolean {
  if (/^--cms-[a-z0-9-]+$/.test(key)) return true;
  return key.startsWith("style.") && SAFE_STYLE_PROPERTIES.has(key.slice(6));
}

const legacyDefinition = (
  id: string,
  name: string,
  description: string,
  category: string,
  props: CmsComponentDefinition["props"],
  structure = "section",
): CmsComponentDefinition => ({
  id,
  name,
  description,
  category,
  version: 1,
  structure,
  styleTokens: tokens,
  props,
  slots: [],
  variants: [{ id: "default", label: "Default" }],
  defaultVariantId: "default",
  ...editorDefaults,
});

export const CMS_COMPONENT_DEFINITIONS: CmsComponentDefinition[] = [
  {
    id: "storefront-header",
    name: "Storefront navbar",
    description: "Global storefront navigation, brand, and account actions.",
    category: "Global",
    version: 1,
    structure: "header > brand + navigation + actions",
    styleTokens: tokens,
    props: [
      prop("brandLabel", "Brand label", "text", "Storefront"),
      prop("accountLabel", "Account label", "text", "Account"),
      prop("bagLabel", "Bag label", "text", "Bag"),
    ],
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
    props: [
      prop("brandLabel", "Brand label", "text", "Storefront"),
      prop("columnsLabel", "Columns label", "text", "Storefront footer columns"),
    ],
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
      prop("mediaType", "Media type", "select", "image"),
      prop("videoUrl", "Video URL", "oembed", ""),
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
  legacyDefinition("header-navigation", "Header navigation", "Global storefront navigation links.", "Global", [], "nav"),
  legacyDefinition("header-actions", "Header actions", "Global account and bag actions.", "Global", [], "div"),
  legacyDefinition("image", "Image", "Responsive image with accessible alternative text.", "Content", [
    prop("src", "Image URL", "image", ""),
    prop("alt", "Alt text", "text", ""),
  ], "figure"),
  legacyDefinition("divider", "Spacer", "A bounded vertical spacing section.", "Layout", [
    prop("heightPx", "Height", "range", 24),
  ]),
  legacyDefinition("faq", "FAQ", "Frequently asked questions with safe rich-text answers.", "Content", [
    prop("items", "Questions", "json", [{ q: "Question?", a: "<p>Answer.</p>" }]),
  ]),
  legacyDefinition("video", "Video", "A validated video or provider embed.", "Media", [
    prop("url", "Video URL", "oembed", ""),
    prop("title", "Accessible title", "text", "Video"),
  ]),
  legacyDefinition("trust-strip", "Trust strip", "Three concise trust and service benefits.", "Content", [
    prop("col1Title", "Column 1 title", "text", "Secure checkout"),
    prop("col1Body", "Column 1 body", "text", ""),
    prop("col2Title", "Column 2 title", "text", "Fast shipping"),
    prop("col2Body", "Column 2 body", "text", ""),
    prop("col3Title", "Column 3 title", "text", "Easy returns"),
    prop("col3Body", "Column 3 body", "text", ""),
  ]),
  legacyDefinition("contact-strip", "Contact strip", "Contact details and support hours.", "Content", [
    prop("phone", "Phone", "tel", ""),
    prop("email", "Email", "email", ""),
    prop("hours", "Hours / note", "text", ""),
  ]),
  legacyDefinition("featured-products", "Featured products", "A live product selection by handle.", "Commerce", [
    prop("slugs", "Product handles", "text", ""),
  ]),
  legacyDefinition("product-grid", "Product grid", "A live product grid selected by product handles.", "Commerce", [
    prop("heading", "Heading", "text", "Featured products"),
    prop("slugs", "Product handles", "text", ""),
    prop("columns", "Columns", "range", 4),
  ]),
  legacyDefinition("promo-banner", "Promotion banner", "A focused promotional message and action.", "Sections", [
    prop("eyebrow", "Eyebrow", "text", ""),
    prop("title", "Title", "text", "Promotion"),
    prop("body", "Supporting text", "text", ""),
    prop("href", "Action URL", "url", "/shop"),
    prop("ctaLabel", "Action label", "text", "Shop now"),
  ]),
  legacyDefinition("feature-grid", "Feature grid", "A bounded grid of merchant-defined benefits.", "Content", [
    prop("heading", "Heading", "text", "Why shop with us"),
    prop("items", "Features", "json", [{ title: "Feature", body: "Description" }]),
  ]),
  legacyDefinition("testimonial-grid", "Testimonials", "Customer quotes displayed as a responsive grid.", "Content", [
    prop("heading", "Heading", "text", "What customers say"),
    prop("items", "Testimonials", "json", [{ quote: "A great experience.", name: "Customer", role: "" }]),
  ]),
  legacyDefinition("announcement-bar", "Announcement bar", "A concise site-wide promotional message.", "Global", [
    prop("message", "Message", "text", ""),
    prop("href", "Link URL", "url", ""),
    prop("linkLabel", "Link label", "text", "Learn more"),
  ], "aside"),
  legacyDefinition("home-tiles", "Homepage category tiles", "Live category tiles for the storefront home page.", "Commerce", [
    prop("tiles", "Tiles", "json", []),
  ], "section > tiles"),
  legacyDefinition("latest-section", "Latest products section", "Live latest-products section.", "Commerce", [
    prop("title", "Title", "text", "THE LATEST DROPS"),
    prop("viewAllLabel", "View all label", "text", "View All Products"),
    prop("viewAllHref", "View all URL", "url", "/shop"),
  ], "section > products"),
  legacyDefinition("footer-columns", "Footer columns", "Global footer link columns.", "Global", [], "footer > columns"),
];

const DEFINITION_BY_ID = new Map(CMS_COMPONENT_DEFINITIONS.map((definition) => [definition.id, definition]));

function defaultPropsForDefinition(definition: CmsComponentDefinition): Record<string, unknown> {
  return Object.fromEntries(
    definition.props
      .filter((item) => item.defaultValue !== undefined)
      .map((item) => [item.key, item.defaultValue]),
  );
}

/**
 * Adds the runtime-safe metadata required by the canonical CMS contract.
 * The legacy definition remains unchanged so persisted organization overrides
 * and old API payloads continue to deserialize during migration.
 */
export function canonicalCmsBlockDefinition(
  definition: CmsComponentDefinition,
): CmsBlockDefinition {
  const dataRequirements = definition.props.flatMap((item) => {
    if (!item.dataSource) return [];
    const [source, key = item.key] = item.dataSource.split(":", 2);
    if (!(["catalog", "collection", "blog", "media", "navigation", "analytics"] as const).includes(source as never)) return [];
    return [{ key, source: source as "catalog" | "collection" | "blog" | "media" | "navigation" | "analytics", required: item.required }];
  });
  return {
    ...definition,
    propsSchema: {
      type: "object",
      properties: Object.fromEntries(definition.props.map((item) => [item.key, {
        type: item.type,
        title: item.label,
        required: item.required === true,
      }])),
    },
    defaultProps: defaultPropsForDefinition(definition),
    dataRequirements,
    permissions: definition.isGlobal ? ["cms:edit", "cms:publish"] : ["cms:edit"],
    responsivePolicy: {
      enabled: definition.responsive !== false,
      visibility: "tokenized",
      allowedPresets: ["show", "hide", "stack", "compact", "default"],
    },
    accessibilityPolicy: {
      requireAltText: definition.props.some((item) => item.type === "image" && item.key.toLowerCase().includes("alt")),
      requireAccessibleName: true,
      semanticRoot: definition.structure.split(/\s|>/, 1)[0] || "section",
    },
    renderer: `cms:${definition.id}`,
    previewRenderer: `cms-preview:${definition.id}`,
    migration: [],
  };
}

export function listCmsBlockDefinitions(): CmsBlockDefinition[] {
  return CMS_COMPONENT_DEFINITIONS.map(canonicalCmsBlockDefinition);
}

export function getCmsBlockDefinition(id: string | undefined): CmsBlockDefinition | undefined {
  const definition = getCmsComponentDefinition(id);
  return definition ? canonicalCmsBlockDefinition(definition) : undefined;
}

export function validateCmsBlockInstance(input: {
  componentId?: string;
  type?: string;
  variantId?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, string>;
}): string[] {
  const definition = getCmsBlockDefinition(input.componentId ?? input.type);
  if (!definition) return [];
  const errors: string[] = [];
  const props = input.props ?? {};
  for (const field of definition.props) {
    if (field.required && (props[field.key] === undefined || props[field.key] === null || props[field.key] === "")) {
      errors.push(`${definition.id}: required prop missing: ${field.key}`);
    }
  }
  if (input.variantId && !definition.variants.some((variant) => variant.id === input.variantId)) {
    errors.push(`${definition.id}: unknown variant: ${input.variantId}`);
  }
  for (const key of Object.keys(input.styles ?? {})) {
    if (!isSafeCmsStyleKey(key)) errors.push(`${definition.id}: unsafe style key: ${key}`);
  }
  return errors;
}

export function listCmsComponentDefinitions() {
  return CMS_COMPONENT_DEFINITIONS;
}

export function getCmsComponentDefinition(id: string | undefined) {
  if (!id) return undefined;
  return DEFINITION_BY_ID.get(id) ?? DEFINITION_BY_ID.get(id.replaceAll("_", "-"));
}

/** Convert any persisted legacy block spelling to the canonical registry id. */
export function cmsComponentIdForType(type: string | undefined) {
  if (!type) return undefined;
  const normalized = type.trim().replaceAll("_", "-");
  return getCmsComponentDefinition(normalized)?.id ?? normalized;
}

/** Return the legacy block spelling used by the flat blocks API. */
export function cmsBlockTypeForComponentId(componentId: string | undefined) {
  return componentId?.replaceAll("-", "_");
}

/** Registry-backed defaults used by every CMS editor and preset creator. */
export function getCmsDefaultProps(typeOrComponentId: string | undefined) {
  const definition = getCmsComponentDefinition(cmsComponentIdForType(typeOrComponentId));
  return Object.fromEntries(
    (definition?.props ?? [])
      .filter((item) => item.defaultValue !== undefined)
      .map((item) => [item.key, item.defaultValue]),
  );
}

export function listCmsBlockPalette() {
  return listCmsBlockDefinitions().map((definition) => ({
    type: definition.id.replaceAll("-", "_"),
    componentId: definition.id,
    label: definition.name,
    group: definition.category,
    renderer: definition.renderer,
    previewRenderer: definition.previewRenderer,
    defaultProps: definition.defaultProps,
    slots: definition.slots,
  }));
}

/** Resolve persisted inheritance without mutating either definition. */
export function resolveCmsComponentDefinition(
  definitions: CmsComponentDefinition[],
  id: string,
): CmsComponentDefinition | undefined {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const visiting = new Set<string>();
  const resolve = (key: string): CmsComponentDefinition | undefined => {
    const current = byId.get(key);
    if (!current || visiting.has(key)) return current;
    visiting.add(key);
    const parent = current.extendsComponentId ? resolve(current.extendsComponentId) : undefined;
    visiting.delete(key);
    if (!parent) return current;
    const mergeBy = <T>(items: T[], keyOf: (_item: T) => string) =>
      [...new Map(items.map((item) => [keyOf(item), item])).values()];
    return {
      ...parent,
      ...current,
      props: mergeBy([...parent.props, ...current.props], (item) => item.key),
      slots: mergeBy([...parent.slots, ...current.slots], (item) => item.name),
      variants: mergeBy([...parent.variants, ...current.variants], (item) => item.id),
      styleTokens: { ...parent.styleTokens, ...current.styleTokens },
    };
  };
  return resolve(id);
}

export function getCmsVariant(definition: CmsComponentDefinition | undefined, variantId?: string) {
  if (!definition) return undefined;
  return definition.variants.find((variant) => variant.id === (variantId ?? definition.defaultVariantId)) ?? definition.variants[0];
}

export function resolveCmsInstanceProps(instance: Pick<CmsComponentInstance, "componentId" | "variantId" | "props">) {
  const definition = getCmsComponentDefinition(instance.componentId);
  const variant = getCmsVariant(definition, instance.variantId);
  const defaults = getCmsDefaultProps(instance.componentId);
  return { ...defaults, ...(variant?.props ?? {}), ...instance.props };
}

export function componentInstanceFromBlock(block: CmsBlock): CmsComponentInstance {
  return {
    id: block.id,
    componentId: block.componentId ?? cmsComponentIdForType(block.type) ?? block.type.replaceAll("_", "-"),
    variantId: block.variantId,
    props: block.props,
    slots: block.slots ?? {},
    styleOverrides: block.styleOverrides,
  };
}

export function blockFromComponentInstance(instance: CmsComponentInstance): CmsBlock {
  return {
    id: instance.id,
    type: cmsBlockTypeForComponentId(instance.componentId) ?? instance.componentId,
    componentId: instance.componentId,
    variantId: instance.variantId,
    props: instance.props,
    slots: instance.slots,
    styleOverrides: instance.styleOverrides,
  };
}
