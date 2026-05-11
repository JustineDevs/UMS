export type CommerceProductLookupParams = {
  categoryId?: string;
  limit: number;
  published?: "published" | "not_published";
  query?: string;
};

export type CommerceProductLookupRow = {
  id: string;
  title: string;
  handle: string;
  sku: string;
  status: string;
  thumbnail_url: string | null;
  category_ids: string[];
};

type CommerceProductLookupPageInput = {
  limit: number;
  offset: number;
  query?: string;
};

export function parseCommerceProductLookupParams(
  searchParams: URLSearchParams,
): CommerceProductLookupParams {
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryId =
    searchParams.get("category_id")?.trim() ||
    searchParams.get("collection_id")?.trim() ||
    "";
  const publishedRaw = searchParams.get("published")?.trim() ?? "";
  const parsedLimit = Number(searchParams.get("limit"));

  return {
    ...(query ? { query } : {}),
    ...(categoryId ? { categoryId } : {}),
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 80)
        : 40,
    ...(publishedRaw === "1" || publishedRaw === "true"
      ? { published: "published" as const }
      : publishedRaw === "0" || publishedRaw === "false"
        ? { published: "not_published" as const }
        : {}),
  };
}

export function filterCommerceProductLookupRows(
  rows: CommerceProductLookupRow[],
  params: CommerceProductLookupParams,
): CommerceProductLookupRow[] {
  let filtered = rows;

  if (params.categoryId) {
    filtered = filtered.filter((row) => row.category_ids.includes(params.categoryId as string));
  }

  if (params.published === "published") {
    filtered = filtered.filter((row) => row.status === "published");
  } else if (params.published === "not_published") {
    filtered = filtered.filter((row) => row.status !== "published");
  }

  return filtered;
}

export async function collectCommerceProductLookupRows(
  params: CommerceProductLookupParams,
  fetchPage: (_input: CommerceProductLookupPageInput) => Promise<CommerceProductLookupRow[]>,
): Promise<CommerceProductLookupRow[]> {
  const requiresLocalFiltering = Boolean(params.categoryId || params.published);
  const pageSize = Math.min(params.limit, 80);
  let offset = 0;
  const collected: CommerceProductLookupRow[] = [];

  while (collected.length < params.limit) {
    const page = await fetchPage({
      limit: pageSize,
      offset,
      query: params.query,
    });
    const filtered = filterCommerceProductLookupRows(page, params);
    for (const row of filtered) {
      if (collected.length >= params.limit) break;
      collected.push(row);
    }

    if (page.length < pageSize || !requiresLocalFiltering) {
      break;
    }
    offset += pageSize;
  }

  return collected;
}
