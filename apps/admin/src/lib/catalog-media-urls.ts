export function catalogMediaUrlsFromProducts(products: unknown[]): string[] {
  const urls = new Set<string>();
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const product = raw as Record<string, unknown>;
    const images = Array.isArray(product.images) ? product.images : [];
    const candidates = [
      product.thumbnail,
      ...images.map((image) =>
        image && typeof image === "object"
          ? (image as Record<string, unknown>).url
          : null,
      ),
    ];
    for (const url of candidates) {
      if (typeof url === "string" && url.trim()) urls.add(url.trim());
    }
  }
  return [...urls];
}
