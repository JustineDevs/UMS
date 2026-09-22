import Image from "next/image";
import Link from "next/link";
import {
  createSupabaseClient,
  blockFromComponentInstance,
  cmsBlockTypeForComponentId,
  getCmsBlockDefinition,
  isSafeCmsStyleKey,
  getCmsPaymentLinkById,
  resolveCmsInstanceProps,
  type CmsBlock,
  type CmsComponentInstance,
  type CmsPaymentLinkRow,
} from "@universal-music-store/platform-data";
import { cloneElement, isValidElement, type CSSProperties } from "react";
import { applyCmsDomOverrides, sanitizeCmsHtml } from "@universal-music-store/validation";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { getCachedProductBySlug } from "@/lib/cached-product";
import { isDirectVideoUrl, youtubeEmbedUrl } from "@/lib/product-media";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

const visualRootStyleProperties = new Set([
  "display", "position", "width", "height", "min-width", "max-width",
  "min-height", "max-height", "margin", "padding", "color",
  "background-color", "background-size", "background-position", "font-family",
  "font-size", "font-weight", "line-height", "letter-spacing", "border",
  "border-radius", "box-shadow", "gap", "align-items", "justify-content",
  "grid-template-columns", "object-fit", "object-position",
]);

function visualRootStyle(overrides: Record<string, unknown>): CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith("style.") || typeof value !== "string") continue;
    const property = key.slice("style.".length);
    if (!visualRootStyleProperties.has(property) || value.length > 200 || /[{};]/.test(value) || /url\s*\(/i.test(value)) continue;
    const reactProperty = property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
    style[reactProperty] = value;
  }
  return style as CSSProperties;
}

function cmsLayoutStyle(layout: unknown): CSSProperties {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) return {};
  const allowed = new Set([
    "maxWidth", "minHeight", "paddingBlock", "paddingInline", "marginBlock",
    "marginInline", "display", "position", "inset", "fontSize", "fontWeight",
    "color", "backgroundColor", "borderRadius", "gap", "gridTemplateColumns",
    "alignItems", "justifyContent", "boxShadow", "backgroundSize",
    "backgroundPosition",
  ]);
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(layout)) {
    if (!allowed.has(key) || typeof value !== "string" || value.length > 200) continue;
    if (/[{};]/.test(value) || /url\s*\(/i.test(value)) continue;
    style[key] = value;
  }
  return style as CSSProperties;
}

type FaqItem = { q: string; a: string };

type FeatureItem = { title: string; body: string };
type TestimonialItem = { quote: string; name: string; role: string };

function parseFaqItems(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FaqItem[] = [];
  for (const x of raw) {
    if (x && typeof x === "object" && "q" in x && "a" in x) {
      const r = x as Record<string, unknown>;
      out.push({
        q: String(r.q ?? ""),
        a: String(r.a ?? ""),
      });
    }
  }
  return out.filter((i) => i.q.trim() || i.a.trim());
}

function parseFeatureItems(raw: unknown): FeatureItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const title = String(item.title ?? "").trim();
    const body = String(item.body ?? "").trim();
    return title || body ? [{ title, body }] : [];
  });
}

function parseTestimonialItems(raw: unknown): TestimonialItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const quote = String(item.quote ?? "").trim();
    const name = String(item.name ?? "").trim();
    const role = String(item.role ?? "").trim();
    return quote || name ? [{ quote, name, role }] : [];
  });
}

function isInternalHref(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function renderCmsAction(href: string, label: string, className: string) {
  if (!href || !label) return null;
  if (isInternalHref(href)) {
    return <Link href={href} className={className}>{label}</Link>;
  }
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return <a href={url.toString()} target="_blank" rel="noreferrer" className={className}>{label}</a>;
  } catch {
    return null;
  }
}

async function loadPaymentLinkById(id: string): Promise<CmsPaymentLinkRow | null> {
  const key = id.trim();
  const organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  if (!key || !organizationId) return null;
  try {
    const supabase = createSupabaseClient();
    return await getCmsPaymentLinkById(supabase, key, organizationId);
  } catch (error) {
    console.warn("[cms-blocks-renderer] loadPaymentLinkById", error);
    return null;
  }
}

const MAX_RENDERED_CMS_BLOCKS = 200;
const MAX_RENDERED_CMS_DEPTH = 4;

async function renderCmsBlocks(
  blocks: CmsBlock[],
  withSectionSpacing: boolean,
  depth = 0,
) {
  if (!blocks.length || depth > MAX_RENDERED_CMS_DEPTH) return null;
  const boundedBlocks = blocks.slice(0, MAX_RENDERED_CMS_BLOCKS);
  const nodes: React.ReactNode[] = [];
  const paymentLinkCache = new Map<string, Promise<CmsPaymentLinkRow | null>>();

  const getPaymentLink = (id: string) => {
    const key = id.trim();
    if (!key) return Promise.resolve(null);
    const cached = paymentLinkCache.get(key);
    if (cached) return cached;
    const promise = loadPaymentLinkById(key);
    paymentLinkCache.set(key, promise);
    return promise;
  };

  const renderSlot = async (instances: CmsComponentInstance[] | undefined) => {
    if (!instances?.length) return null;
    return renderCmsBlocks(instances.map(blockFromComponentInstance), false, depth + 1);
  };

  for (const rawBlock of boundedBlocks) {
    const canonicalDefinition = getCmsBlockDefinition(rawBlock.componentId ?? rawBlock.type);
    const canonicalComponentId = canonicalDefinition?.id
      ?? rawBlock.componentId
      ?? rawBlock.type.replaceAll("_", "-");
    const b: CmsBlock = {
      ...rawBlock,
      type: canonicalDefinition
        ? cmsBlockTypeForComponentId(canonicalDefinition.id) ?? rawBlock.type
        : rawBlock.type,
      componentId: canonicalComponentId,
      props: resolveCmsInstanceProps({
        componentId: canonicalComponentId,
        variantId: rawBlock.variantId,
        props: rawBlock.props,
      }),
    };
    switch (b.type) {
      case "visual_primitive": {
        const sourceType = String(b.props.sourceType ?? "visual");
        const rawDomOverrides = b.props.domOverrides;
        const domOverrides = rawDomOverrides && typeof rawDomOverrides === "object"
          ? rawDomOverrides as Record<string, Record<string, unknown>>
          : {};
        const rootOverrides = domOverrides[b.id] ?? {};
        const sourceMarkup = sanitizeCmsHtml(String(b.props.markup ?? ""));
        const content = applyCmsDomOverrides(typeof rootOverrides.innerHTML === "string"
          ? sanitizeCmsHtml(rootOverrides.innerHTML)
          : sourceMarkup, domOverrides);
        const style = visualRootStyle(rootOverrides);
        nodes.push(
          <div
            key={b.id}
            data-cms-id={b.id}
            data-cms-label={String(b.props.sourceName ?? sourceType)}
            data-cms-block-id={b.id}
            data-cms-block-type="visual_primitive"
            data-cms-source-type={sourceType}
            style={Object.keys(style).length ? style : undefined}
            dangerouslySetInnerHTML={{ __html: content }}
          />,
        );
        break;
      }
      case "hero": {
        const title = String(b.props.title ?? "");
        const subtitle = String(b.props.subtitle ?? "");
        const rawImageUrl = b.props.imageUrl;
        const rawHref = b.props.href;
        const imageUrl = typeof rawImageUrl === "string" ? rawImageUrl : "";
        const href = typeof rawHref === "string" ? rawHref : "";
        const cta = String(b.props.ctaLabel ?? "Learn more");
        const actions = await renderSlot(b.slots?.actions);
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="hero"
            className="relative overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low"
          >
            {imageUrl ? (
              <div className="relative aspect-[21/9] w-full">
                <Image
                  data-cms-id={`${b.id}::image`}
                  data-cms-label="Hero image"
                  data-cms-url-prop="imageUrl"
                  src={imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  unoptimized={shouldUnoptimizeImage(imageUrl)}
                />
              </div>
            ) : null}
            <div className="p-8 sm:p-10">
              {title ? (
                <h2 data-cms-id={`${b.id}::title`} data-cms-label="Headline" data-cms-prop="title" className="font-headline text-2xl font-bold text-primary sm:text-3xl">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p data-cms-id={`${b.id}::subtitle`} data-cms-label="Supporting text" data-cms-prop="subtitle" className="mt-3 font-body text-sm leading-relaxed text-on-surface-variant">
                  {subtitle}
                </p>
              ) : null}
              {href ? (
                <Link
                  data-cms-id={`${b.id}::cta`}
                  data-cms-label="Primary action"
                  data-cms-prop="ctaLabel"
                  data-cms-url-prop="href"
                  href={href}
                  className="mt-6 inline-flex rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  {cta}
                </Link>
              ) : null}
              {actions}
            </div>
          </section>,
        );
        break;
      }
      case "rich_text": {
        const html = sanitizeCmsHtml(String(b.props.html ?? ""));
        if (!html.trim()) break;
        nodes.push(
          <div
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="rich_text"
            data-cms-prop="html"
            data-cms-value-kind="html"
            className="prose prose-sm max-w-none font-body text-on-surface-variant"
            dangerouslySetInnerHTML={{ __html: html }}
          />,
        );
        break;
      }
      case "image": {
        const src = String(b.props.src ?? "");
        const alt = String(b.props.alt ?? "");
        if (!src) break;
        nodes.push(
          <figure
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="image"
            className="overflow-hidden rounded-xl"
          >
            <div className="relative aspect-video w-full">
              <Image
                data-cms-id={`${b.id}::media`}
                data-cms-label="Image"
                data-cms-prop="alt"
                data-cms-url-prop="src"
                src={src}
                alt={alt}
                fill
                className="object-cover"
                sizes="(max-width: 960px) 100vw, 960px"
                unoptimized={shouldUnoptimizeImage(src)}
              />
            </div>
            {alt ? (
              <figcaption data-cms-id={`${b.id}::caption`} data-cms-label="Caption" data-cms-prop="alt" className="mt-2 text-xs text-on-surface-variant">{alt}</figcaption>
            ) : null}
          </figure>,
        );
        break;
      }
      case "cta_row": {
        const label = String(b.props.label ?? "");
        const href = String(b.props.href ?? "");
        if (!href) break;
        nodes.push(
          <div
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="cta_row"
            className="flex justify-center"
          >
            <Link
              data-cms-id={`${b.id}::action`}
              data-cms-label="Action"
              data-cms-prop="label"
              data-cms-url-prop="href"
              href={href}
              className="inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {label || "Continue"}
            </Link>
          </div>,
        );
        break;
      }
      case "divider": {
        const h = String(b.props.heightPx ?? "24");
        nodes.push(
          <div
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="divider"
            className="w-full border-t border-outline-variant/20"
            style={{ marginTop: `${h}px`, marginBottom: `${h}px` }}
            data-cms-prop="heightPx"
            data-cms-value-kind="number"
            aria-hidden
          />,
        );
        break;
      }
      case "two_column": {
        const htmlRaw = String(b.props.html ?? "");
        const html = sanitizeCmsHtml(htmlRaw);
        const imageUrl = String(b.props.imageUrl ?? "");
        const imageAlt = String(b.props.imageAlt ?? "");
        const reverse = Boolean(b.props.reverse);
        const contentSlot = await renderSlot(b.slots?.content);
        const mediaSlot = await renderSlot(b.slots?.media);
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="two_column"
            className={`grid gap-8 md:grid-cols-2 md:items-center ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}
          >
            {mediaSlot ?? (imageUrl ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-container-low">
                <Image
                  data-cms-id={`${b.id}::media`}
                  data-cms-label="Image"
                  data-cms-prop="imageAlt"
                  data-cms-url-prop="imageUrl"
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ) : null)}
            {contentSlot ?? (html.trim() ? (
              <div
                data-cms-id={`${b.id}::content`}
                data-cms-label="Text content"
            className="prose prose-sm max-w-none font-body text-on-surface-variant"
          >
            <div data-cms-id={`${b.id}::content`} data-cms-label="Text content" data-cms-prop="html" data-cms-value-kind="html" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            ) : null)}
          </section>,
        );
        break;
      }
      case "faq": {
        const items = parseFaqItems(b.props.items);
        if (!items.length) break;
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="faq"
            className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-6"
          >
            {items.map((item, i) => (
              <details key={`${item.q}-${item.a ?? "answer"}`} className="group border-b border-outline-variant/15 pb-3 last:border-0">
                <summary data-cms-id={`${b.id}::question-${i}`} data-cms-label={`Question ${i + 1}`} data-cms-prop="items" data-cms-array-index={i} data-cms-array-field="q" className="cursor-pointer list-none font-semibold text-primary">
                  {item.q}
                  <span className="material-symbols-outlined float-right text-on-surface-variant transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <div
                  data-cms-id={`${b.id}::answer-${i}`}
                  data-cms-label={`Answer ${i + 1}`}
                  data-cms-prop="items"
                  data-cms-array-index={i}
                  data-cms-array-field="a"
                  data-cms-value-kind="html"
                  className="mt-2 text-sm leading-relaxed text-on-surface-variant"
                  dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(item.a) }}
                />
              </details>
            ))}
          </section>,
        );
        break;
      }
      case "video": {
        const url = String(b.props.url ?? "");
        const title = String(b.props.title ?? "Video");
        const yt = youtubeEmbedUrl(url);
        if (yt) {
          nodes.push(
            <div
              key={b.id}
              data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
              data-cms-block-type="video"
              className="relative aspect-video w-full overflow-hidden rounded-xl bg-black"
            >
              <iframe
                data-cms-id={`${b.id}::player`}
                data-cms-label="Video player"
                data-cms-url-prop="url"
                title={title}
                src={yt}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>,
          );
        } else if (isDirectVideoUrl(url)) {
          nodes.push(
            <video
              key={b.id}
              data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
              data-cms-block-type="video"
              data-cms-url-prop="url"
              controls
              className="w-full rounded-xl"
              src={url}
            >
              <track kind="captions" />
            </video>,
          );
        }
        break;
      }
      case "trust_strip": {
        const col1t = String(b.props.col1Title ?? "Secure checkout");
        const col1b = String(b.props.col1Body ?? "");
        const col2t = String(b.props.col2Title ?? "Shipping");
        const col2b = String(b.props.col2Body ?? "");
        const col3t = String(b.props.col3Title ?? "Returns");
        const col3b = String(b.props.col3Body ?? "");
        nodes.push(
          <div
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="trust_strip"
            className="grid gap-6 rounded-xl border border-outline-variant/20 bg-surface-container-low/30 p-6 sm:grid-cols-3"
          >
            <div>
              <p data-cms-id={`${b.id}::column-1-title`} data-cms-label="Trust point 1" data-cms-prop="col1Title" className="text-xs font-bold uppercase tracking-wider text-primary">{col1t}</p>
              <p data-cms-id={`${b.id}::column-1-body`} data-cms-label="Trust point 1 body" data-cms-prop="col1Body" className="mt-2 text-sm text-on-surface-variant">{col1b}</p>
            </div>
            <div>
              <p data-cms-id={`${b.id}::column-2-title`} data-cms-label="Trust point 2" data-cms-prop="col2Title" className="text-xs font-bold uppercase tracking-wider text-primary">{col2t}</p>
              <p data-cms-id={`${b.id}::column-2-body`} data-cms-label="Trust point 2 body" data-cms-prop="col2Body" className="mt-2 text-sm text-on-surface-variant">{col2b}</p>
            </div>
            <div>
              <p data-cms-id={`${b.id}::column-3-title`} data-cms-label="Trust point 3" data-cms-prop="col3Title" className="text-xs font-bold uppercase tracking-wider text-primary">{col3t}</p>
              <p data-cms-id={`${b.id}::column-3-body`} data-cms-label="Trust point 3 body" data-cms-prop="col3Body" className="mt-2 text-sm text-on-surface-variant">{col3b}</p>
            </div>
          </div>,
        );
        break;
      }
      case "contact_strip": {
        const phone = String(b.props.phone ?? "");
        const email = String(b.props.email ?? "");
        const hours = String(b.props.hours ?? "");
        nodes.push(
          <div
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="contact_strip"
            className="rounded-xl border border-outline-variant/20 bg-surface-container-low/30 p-6 text-sm text-on-surface-variant"
          >
            {phone ? (
              <p data-cms-id={`${b.id}::phone`} data-cms-label="Phone" data-cms-prop="phone">
                <strong className="text-primary">Phone:</strong> {phone}
              </p>
            ) : null}
            {email ? (
              <p data-cms-id={`${b.id}::email`} data-cms-label="Email" data-cms-prop="email" className="mt-2">
                <strong className="text-primary">Email:</strong>{" "}
                <a href={`mailto:${email}`} className="underline">
                  {email}
                </a>
              </p>
            ) : null}
            {hours ? <p data-cms-id={`${b.id}::hours`} data-cms-label="Business hours" data-cms-prop="hours" className="mt-2">{hours}</p> : null}
          </div>,
        );
        break;
      }
      case "newsletter": {
        const heading = String(b.props.heading ?? "Newsletter");
        const sub = String(b.props.subtitle ?? "");
        const actionUrl = String(b.props.actionUrl ?? "");
        const formSlot = await renderSlot(b.slots?.form);
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="newsletter"
            className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-8"
          >
            <h2 data-cms-id={`${b.id}::heading`} data-cms-label="Signup heading" data-cms-prop="heading" className="font-headline text-xl font-bold text-primary">{heading}</h2>
            {sub ? <p data-cms-id={`${b.id}::subtitle`} data-cms-label="Signup supporting text" data-cms-prop="subtitle" className="mt-2 text-sm text-on-surface-variant">{sub}</p> : null}
            {formSlot ?? (actionUrl ? (
              <form data-cms-id={`${b.id}::form`} data-cms-label="Signup form" data-cms-url-prop="action" method="get" action={actionUrl} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor={`nl-${b.id}`}>
                  Email
                </label>
                <input
                  id={`nl-${b.id}`}
                  name="email"
                  type="email"
                  required
                  placeholder="Email address"
                  className="flex-1 rounded-lg border border-outline-variant/30 px-4 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white"
                >
                  Subscribe
                </button>
              </form>
            ) : (
              <p className="mt-4 text-xs text-on-surface-variant">
                Set the form action URL in the CMS block to enable signup.
              </p>
            ))}
          </section>,
        );
        break;
      }
      case "announcement_bar": {
        const message = String(b.props.message ?? "").trim();
        if (!message) break;
        const href = String(b.props.href ?? "").trim();
        const linkLabel = String(b.props.linkLabel ?? "Learn more").trim();
        nodes.push(
          <aside
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="announcement_bar"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-center text-sm text-white"
          >
            <span data-cms-id={`${b.id}::message`} data-cms-label="Announcement" data-cms-prop="message">{message}</span>
            {href ? renderCmsAction(href, linkLabel, "font-semibold underline underline-offset-2") : null}
          </aside>,
        );
        break;
      }
      case "promo_banner": {
        const eyebrow = String(b.props.eyebrow ?? "").trim();
        const title = String(b.props.title ?? "").trim();
        const body = String(b.props.body ?? "").trim();
        const href = String(b.props.href ?? "").trim();
        const ctaLabel = String(b.props.ctaLabel ?? "Shop now").trim();
        if (!title && !body) break;
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="promo_banner"
            className="flex flex-col gap-5 rounded-2xl bg-primary p-8 text-white sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="max-w-2xl">
              {eyebrow ? <p data-cms-id={`${b.id}::eyebrow`} data-cms-label="Eyebrow" data-cms-prop="eyebrow" className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{eyebrow}</p> : null}
              {title ? <h2 data-cms-id={`${b.id}::title`} data-cms-label="Title" data-cms-prop="title" className="mt-1 font-headline text-2xl font-bold">{title}</h2> : null}
              {body ? <p data-cms-id={`${b.id}::body`} data-cms-label="Supporting text" data-cms-prop="body" className="mt-2 text-sm leading-relaxed text-white/80">{body}</p> : null}
            </div>
            {href ? renderCmsAction(href, ctaLabel, "inline-flex shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-white/90") : null}
          </section>,
        );
        break;
      }
      case "feature_grid": {
        const heading = String(b.props.heading ?? "").trim();
        const items = parseFeatureItems(b.props.items);
        if (!items.length) break;
        nodes.push(
          <section key={b.id} data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id} data-cms-block-type="feature_grid" className="space-y-5">
            {heading ? <h2 data-cms-id={`${b.id}::heading`} data-cms-label="Heading" data-cms-prop="heading" className="font-headline text-2xl font-bold text-primary">{heading}</h2> : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => (
                <article key={`${item.title}-${index}`} className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-5">
                  {item.title ? <h3 data-cms-id={`${b.id}::item-${index}-title`} data-cms-label={`Feature ${index + 1} title`} data-cms-prop="items" data-cms-array-index={index} data-cms-array-field="title" className="font-semibold text-primary">{item.title}</h3> : null}
                  {item.body ? <p data-cms-id={`${b.id}::item-${index}-body`} data-cms-label={`Feature ${index + 1} body`} data-cms-prop="items" data-cms-array-index={index} data-cms-array-field="body" className="mt-2 text-sm leading-relaxed text-on-surface-variant">{item.body}</p> : null}
                </article>
              ))}
            </div>
          </section>,
        );
        break;
      }
      case "testimonial_grid": {
        const heading = String(b.props.heading ?? "").trim();
        const items = parseTestimonialItems(b.props.items);
        if (!items.length) break;
        nodes.push(
          <section key={b.id} data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id} data-cms-block-type="testimonial_grid" className="space-y-5">
            {heading ? <h2 data-cms-id={`${b.id}::heading`} data-cms-label="Heading" data-cms-prop="heading" className="font-headline text-2xl font-bold text-primary">{heading}</h2> : null}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => (
                <figure key={`${item.name}-${index}`} className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-5">
                  {item.quote ? <blockquote data-cms-id={`${b.id}::item-${index}-quote`} data-cms-label={`Testimonial ${index + 1}`} data-cms-prop="items" data-cms-array-index={index} data-cms-array-field="quote" className="text-sm leading-relaxed text-on-surface-variant">“{item.quote}”</blockquote> : null}
                  {item.name ? <figcaption data-cms-id={`${b.id}::item-${index}-name`} data-cms-label={`Testimonial ${index + 1} name`} data-cms-prop="items" data-cms-array-index={index} data-cms-array-field="name" className="mt-4 font-semibold text-primary">{item.name}{item.role ? <span className="ml-2 font-normal text-on-surface-variant">{item.role}</span> : null}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>,
        );
        break;
      }
      case "product_grid": {
        const heading = String(b.props.heading ?? "").trim();
        const slugs = String(b.props.slugs ?? "").split(/[\s,]+/).map((slug) => slug.trim()).filter(Boolean).slice(0, 8);
        const columns = Math.min(4, Math.max(2, Number(b.props.columns) || 4));
        const products = [];
        for (const slug of slugs) {
          const res = await getCachedProductBySlug(slug);
          if (res.kind === "ok") products.push(res.product);
        }
        if (!products.length) break;
        const gridClass = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
        nodes.push(
          <section key={b.id} data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id} data-cms-block-type="product_grid" className="space-y-5">
            {heading ? <h2 data-cms-id={`${b.id}::heading`} data-cms-label="Heading" data-cms-prop="heading" className="font-headline text-2xl font-bold text-primary">{heading}</h2> : null}
            <div data-cms-id={`${b.id}::grid`} data-cms-label="Product grid" data-cms-prop="slugs" className={`grid gap-8 ${gridClass}`}>
              {products.map((product) => <CatalogProductCard key={product.id} product={product} />)}
            </div>
          </section>,
        );
        break;
      }
      case "featured_products": {
        const raw = String(b.props.slugs ?? "");
        const slugs = raw
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8);
        const products = [];
        for (const slug of slugs) {
          const res = await getCachedProductBySlug(slug);
          if (res.kind === "ok") products.push(res.product);
        }
        if (!products.length) break;
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="featured_products"
            className="space-y-6"
          >
            <div data-cms-id={`${b.id}::grid`} data-cms-label="Product grid" data-cms-prop="slugs" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p) => (
                <CatalogProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>,
        );
        break;
      }
      case "payment_link": {
        const paymentLinkId = String(b.props.paymentLinkId ?? "").trim();
        const showDescription = b.props.showDescription !== false;
        if (!paymentLinkId) break;
        const paymentLink = await getPaymentLink(paymentLinkId);
        if (!paymentLink) break;
        const isActive = paymentLink.active;
        const paymentUrl = paymentLink.payment_url.trim();
        if (!paymentUrl) break;
        nodes.push(
          <section
            key={b.id}
            data-cms-id={b.id} data-cms-label={b.type} data-cms-block-id={b.id}
            data-cms-block-type="payment_link"
            className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                  <p data-cms-id={`${b.id}::provider`} data-cms-label="Payment provider" data-cms-prop="provider" className="text-xs font-bold uppercase tracking-wider text-primary">
                  {paymentLink.provider}
                </p>
                <h2 data-cms-id={`${b.id}::title`} data-cms-label="Payment title" data-cms-prop="title" className="font-headline text-2xl font-bold text-primary">
                  {paymentLink.title}
                </h2>
                {showDescription && paymentLink.description.trim() ? (
                  <p data-cms-id={`${b.id}::description`} data-cms-label="Payment description" data-cms-prop="description" className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                    {paymentLink.description}
                  </p>
                ) : null}
                <p className="text-xs text-on-surface-variant">
                  Locale {paymentLink.locale} · {isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                {isActive ? (
                  <a
                    data-cms-id={`${b.id}::action`}
                    data-cms-label="Payment action"
                    data-cms-prop="cta_label"
                    data-cms-url-prop="href"
                    href={paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    {paymentLink.cta_label || "Pay now"}
                  </a>
                ) : (
                  <span className="inline-flex rounded-full border border-outline-variant/20 px-6 py-3 text-sm font-semibold text-on-surface-variant">
                    Temporarily unavailable
                  </span>
                )}
              </div>
            </div>
          </section>,
        );
        break;
      }
      default:
        break;
    }
  }

  if (!nodes.length) return null;
  const content = (
    <>
      {nodes.map((node, index) => {
        if (!isValidElement(node)) return node;
        const rawBlock = boundedBlocks.find((block) => String(node.key) === block.id) ?? boundedBlocks[index];
        const styleOverrides = Object.fromEntries(
          Object.entries(rawBlock.styleOverrides ?? {}).filter(
            ([key, value]) => isSafeCmsStyleKey(key) && typeof value === "string" && value.length <= 200,
          ),
        );
        const visualStyles = Object.fromEntries(
          Object.entries(styleOverrides)
            .filter(([key]) => key.startsWith("style."))
            .map(([key, value]) => [
              key.slice(6).replace(/-([a-z])/g, (_, character: string) => character.toUpperCase()),
              value,
            ]),
        );
        const themeStyles = Object.fromEntries(
          Object.entries(styleOverrides).filter(([key]) => key.startsWith("--cms-")),
        );
        const existingStyle = typeof node.props.style === "object" && node.props.style ? node.props.style : {};
        const layoutStyle = cmsLayoutStyle(rawBlock.props.layout);
        return cloneElement(node, {
          "data-cms-instance-id": rawBlock.id,
          "data-cms-component-id": rawBlock.componentId ?? rawBlock.type.replaceAll("_", "-"),
          "data-cms-variant": rawBlock.variantId ?? "default",
          style: { ...existingStyle, ...layoutStyle, ...visualStyles, ...themeStyles },
        });
      })}
    </>
  );

  return withSectionSpacing ? <div className="mt-10 space-y-10">{content}</div> : content;
}

export async function CmsBlocksRenderer({ blocks }: { blocks: CmsBlock[] }) {
  return renderCmsBlocks(blocks, true);
}
