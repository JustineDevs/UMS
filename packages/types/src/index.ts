// Shared domain types (catalog / storefront Product shape from Medusa mapping)

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  sortOrder: number;
}

/** Ordered hero media for PDP carousel (images from Medusa + videos from metadata). */
export type ProductGallerySlide =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string };

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  type: string;
  finish: string;
  pickupConfig: string;
  bodyWood: string;
  condition: string;
  skillLevel: string;
  shippingSpeed: string;
  price: number;
  compareAtPrice: number | null;
  cost: number | null;
  /** Medusa `manage_inventory !== false` (undefined treated as tracked). */
  manageInventory: boolean;
  /** From Store API `+variants.inventory_quantity`; null when omitted. */
  inventoryQuantity: number | null;
  /** Sellable on the storefront (in stock or not inventory-managed). */
  isActive: boolean;
}

/** Clickable region on a lifestyle image linking to another product PDP. */
export interface ProductImageHotspot {
  xPct: number;
  yPct: number;
  productSlug: string;
  label?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  brand: string | null;
  /** ISO timestamp when present (for sort). */
  createdAt: string | null;
  images: ProductImage[];
  /** Combined image + video slides for the product page gallery. */
  gallerySlides: ProductGallerySlide[];
  variants: ProductVariant[];
  /** From Medusa product metadata (single source of truth in commerce DB). */
  videoUrl: string | null;
  weightKg: number | null;
  dimensionsLabel: string | null;
  material: string | null;
  /** Optional lifestyle hero image URL with clickable hotspots. */
  lifestyleImageUrl: string | null;
  hotspots: ProductImageHotspot[];
  /** Related product handles for cross-sell (same category or explicit list). */
  relatedHandles: string[];
  /** SEO helper stored in metadata; storefront can prefer over auto-truncated description. */
  seoDescription: string | null;
}

export { inferReviewProofMedia, type ReviewProofMedia, type ReviewProofMediaKind } from "./review-proof-media";
