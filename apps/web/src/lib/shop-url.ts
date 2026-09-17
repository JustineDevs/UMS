export type ShopQuery = {
  category?: string;
  type?: string;
  finish?: string;
  brand?: string;
  pickupConfig?: string;
  bodyWood?: string;
  condition?: string;
  skillLevel?: string;
  shippingSpeed?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Catalog search (name / slug). */
  search?: string;
  sort?: string;
  offset?: number;
};

export function shopHref(q: ShopQuery): string {
  const params = new URLSearchParams();
  if (q.category?.trim()) params.set("category", q.category.trim());
  if (q.type?.trim()) params.set("type", q.type.trim());
  if (q.finish?.trim()) params.set("finish", q.finish.trim());
  if (q.brand?.trim()) params.set("brand", q.brand.trim());
  if (q.pickupConfig?.trim()) params.set("pickupConfig", q.pickupConfig.trim());
  if (q.bodyWood?.trim()) params.set("bodyWood", q.bodyWood.trim());
  if (q.condition?.trim()) params.set("condition", q.condition.trim());
  if (q.skillLevel?.trim()) params.set("skillLevel", q.skillLevel.trim());
  if (q.shippingSpeed?.trim()) params.set("shippingSpeed", q.shippingSpeed.trim());
  if (q.minPrice != null && Number.isFinite(q.minPrice) && q.minPrice >= 0) {
    params.set("minPrice", String(q.minPrice));
  }
  if (q.maxPrice != null && Number.isFinite(q.maxPrice) && q.maxPrice >= 0) {
    params.set("maxPrice", String(q.maxPrice));
  }
  if (q.search?.trim()) params.set("q", q.search.trim());
  if (q.sort?.trim()) params.set("sort", q.sort.trim());
  if (q.offset != null && q.offset > 0) params.set("offset", String(q.offset));
  const s = params.toString();
  return s ? `/shop?${s}` : "/shop";
}
