import type { Metadata } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

/** Legal / brand label for titles, footer, and structured data. */
export const SITE_NAME = "Universal Music Store";

/** Factual summary for meta tags and JSON-LD. */
export const SITE_DESCRIPTION =
  "Music retail for instruments, accessories, and gear. Shipping in the Philippines. Browse by category, type, finish, and brand.";

export const SEO_KEYWORDS = {
  sitewide: [
    "Universal Music Store",
    "music store Philippines",
    "online music store",
    "instrument shop Philippines",
    "music gear",
  ],
  home: [
    "guitars Philippines",
    "bass guitars",
    "drums",
    "keyboards",
    "amplifiers",
    "instrument accessories",
  ],
  shop: [
    "shop guitars",
    "buy instruments online",
    "music instruments store",
    "guitar shop",
    "bass shop",
  ],
  collections: [
    "instrument collections",
    "shop by category",
    "guitar categories",
    "music gear collections",
  ],
  product: [
    "product details",
    "instrument price",
    "music gear availability",
    "buy guitar online",
  ],
  blog: [
    "music buying guide",
    "guitar blog",
    "instrument guide",
    "music retail updates",
  ],
  faq: [
    "shipping FAQ",
    "returns FAQ",
    "music store help",
    "store policy questions",
  ],
  help: [
    "help center",
    "customer support",
    "order help",
    "shipping help",
  ],
  contact: [
    "contact music store",
    "support team",
    "customer service",
    "order questions",
  ],
  policies: [
    "privacy policy",
    "terms of service",
    "returns policy",
    "shipping policy",
  ],
  utility: [
    "track order",
    "sign in",
    "account",
    "checkout",
  ],
} as const;

export function mergeKeywords(...groups: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const item of group) {
      const keyword = item.trim();
      if (!keyword || seen.has(keyword.toLowerCase())) continue;
      seen.add(keyword.toLowerCase());
      out.push(keyword);
    }
  }
  return out;
}

function getBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN;
  return url.replace(/\/$/, "");
}

export function canonicalUrl(path: string): string {
  const base = getBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const full = `${base}${p}`;
  const protocolEnd = full.indexOf("://");
  if (protocolEnd === -1) return full.replace(/\/+/g, "/");
  const protocol = full.slice(0, protocolEnd + 3);
  const rest = full.slice(protocolEnd + 3).replace(/\/+/g, "/");
  return protocol + rest;
}

type PageMetadataInput = {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  noindex?: boolean;
  openGraphType?: "website" | "article";
  image?: string;
  imageAlt?: string;
  referrer?: Metadata["referrer"];
};

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  noindex,
  openGraphType = "website",
  image,
  imageAlt,
  referrer,
}: PageMetadataInput): Metadata {
  const canonical = path ? canonicalUrl(path) : undefined;
  const mergedKeywords = mergeKeywords([...SEO_KEYWORDS.sitewide], keywords);
  const meta: Metadata = {
    title,
    description,
    keywords: mergedKeywords.length > 0 ? mergedKeywords : undefined,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: openGraphType,
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: image ? [{ url: image, alt: imageAlt ?? title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
    referrer,
    robots: noindex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  };

  return meta;
}

export function buildJsonLdOrganization(options?: {
  sameAs?: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoPath?: string;
}) {
  const base = getBaseUrl();
  const sameAs = (options?.sameAs ?? []).map((url) => url.trim()).filter(Boolean);
  const logoPath = options?.logoPath ?? "/UVS/UVS_logo_landscape.png";
  const contactPoint =
    options?.contactEmail || options?.contactPhone
      ? [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: options.contactEmail ?? undefined,
            telephone: options.contactPhone ?? undefined,
          },
        ]
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: base,
    logo: canonicalUrl(logoPath),
    description: SITE_DESCRIPTION,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    contactPoint,
  };
}

export function buildJsonLdWebSite() {
  const url = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
    description: SITE_DESCRIPTION,
    inLanguage: "en-PH",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildJsonLdWebPage(input: {
  name: string;
  description?: string;
  path: string;
  image?: string;
  breadcrumbs?: { name: string; href: string }[];
}) {
  const url = canonicalUrl(input.path);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getBaseUrl(),
    },
  };
  if (input.image) schema.primaryImageOfPage = input.image;
  if (input.breadcrumbs?.length) {
    schema.breadcrumb = buildJsonLdBreadcrumb(input.breadcrumbs);
  }
  return schema;
}

export function buildJsonLdArticle(input: {
  headline: string;
  description?: string;
  path: string;
  datePublished: string;
  dateModified: string;
  image?: string | string[] | null;
  authors: Array<{ name: string; url?: string }>;
}) {
  const url = canonicalUrl(input.path);
  const author = input.authors
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      "@type": "Person",
      name: item.name,
      ...(item.url ? { url: item.url } : {}),
    }));
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    ...(author.length > 0 ? { author: author.length === 1 ? author[0] : author } : {}),
    image:
      input.image == null
        ? undefined
        : Array.isArray(input.image)
          ? input.image
          : [input.image],
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getBaseUrl(),
    },
  };
}

export function buildJsonLdFaq(
  items: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildJsonLdProduct(product: {
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  brand?: string | null;
  images: { imageUrl: string }[];
  variants: {
    price: number;
    sku?: string;
    isActive?: boolean;
    inventoryQuantity?: number | null;
    manageInventory?: boolean;
  }[];
  reviewAverage?: number | null;
  reviewCount?: number;
}) {
  const base = getBaseUrl();
  const url = `${base}/shop/${product.slug}`;
  const sellableVariants = product.variants.filter((v) => {
    if (v.isActive === false) return false;
    if (v.manageInventory && typeof v.inventoryQuantity === "number") {
      return v.inventoryQuantity > 0;
    }
    return true;
  });
  const minPrice = sellableVariants.length
    ? Math.min(...sellableVariants.map((v) => v.price))
    : product.variants.length
      ? Math.min(...product.variants.map((v) => v.price))
      : 0;
  const hasStock = sellableVariants.length > 0;
  const imageList = product.images.map((i) => i.imageUrl).filter(Boolean);
  const fallbackImage = `${base}/icons/android-chrome-512x512.png`;
  const primarySku = sellableVariants[0]?.sku ?? product.variants[0]?.sku;
  const priceValidUntil = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    description: product.description ?? product.name,
    image: imageList.length > 0 ? imageList : [fallbackImage],
    category: product.category ?? undefined,
    ...(primarySku ? { sku: primarySku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PHP",
      price: minPrice,
      priceValidUntil,
      availability: hasStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (product.reviewAverage && product.reviewCount && product.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.reviewAverage.toFixed(1),
      reviewCount: product.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return schema;
}

export function buildJsonLdBreadcrumb(
  items: { name: string; href: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.href.startsWith("http")
        ? item.href
        : canonicalUrl(item.href),
    })),
  };
}
