import Image from "next/image";
import Link from "next/link";
import {
  createSupabaseClient,
  blockFromComponentInstance,
  getCmsPaymentLinkById,
  resolveCmsInstanceProps,
  type CmsBlock,
  type CmsComponentInstance,
  type CmsPaymentLinkRow,
} from "@universal-music-store/platform-data";
import { cloneElement, isValidElement } from "react";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { getCachedProductBySlug } from "@/lib/cached-product";
import { isDirectVideoUrl, youtubeEmbedUrl } from "@/lib/product-media";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

type FaqItem = { q: string; a: string };

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

async function renderCmsBlocks(blocks: CmsBlock[], withSectionSpacing: boolean) {
  if (!blocks.length) return null;
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
    return renderCmsBlocks(instances.map(blockFromComponentInstance), false);
  };

  for (const rawBlock of blocks) {
    const b: CmsBlock = {
      ...rawBlock,
      props: resolveCmsInstanceProps({
        componentId: rawBlock.componentId ?? rawBlock.type,
        variantId: rawBlock.variantId,
        props: rawBlock.props,
      }),
    };
    switch (b.type) {
      case "hero": {
        const title = String(b.props.title ?? "");
        const subtitle = String(b.props.subtitle ?? "");
        const imageUrl = typeof b.props.imageUrl === "string" ? b.props.imageUrl : "";
        const href = typeof b.props.href === "string" ? b.props.href : "";
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
              <details key={i} className="group border-b border-outline-variant/15 pb-3 last:border-0">
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
        const rawBlock = blocks.find((block) => String(node.key) === block.id) ?? blocks[index];
        const styleOverrides = Object.fromEntries(
          Object.entries(rawBlock.styleOverrides ?? {}).filter(
            ([key, value]) => /^--cms-[a-z0-9-]+$/.test(key) && typeof value === "string" && value.length <= 200,
          ),
        );
        const existingStyle = typeof node.props.style === "object" && node.props.style ? node.props.style : {};
        return cloneElement(node, {
          "data-cms-instance-id": rawBlock.id,
          "data-cms-component-id": rawBlock.componentId ?? rawBlock.type.replaceAll("_", "-"),
          "data-cms-variant": rawBlock.variantId ?? "default",
          style: { ...existingStyle, ...styleOverrides },
        });
      })}
    </>
  );

  return withSectionSpacing ? <div className="mt-10 space-y-10">{content}</div> : content;
}

export async function CmsBlocksRenderer({ blocks }: { blocks: CmsBlock[] }) {
  return renderCmsBlocks(blocks, true);
}
