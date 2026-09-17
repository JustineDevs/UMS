import { NextResponse } from "next/server";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import {
  rankSearchSuggestions,
  expandSearchQueries,
} from "@/lib/search-suggestion-ranking";

const SUGGESTION_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=5, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`search-suggest:${ip}`, 90, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { suggestions: [], error: "rate_limited", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] }, { headers: SUGGESTION_CACHE_HEADERS });
  }
  if (q.length > 100) {
    return NextResponse.json({ suggestions: [] }, { headers: SUGGESTION_CACHE_HEADERS });
  }
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) {
    return NextResponse.json(
      { suggestions: [], error: "catalog_unavailable" },
      { status: 503 },
    );
  }
  try {
    const suggestionsBySlug = new Map<string, {
      slug: string;
      name: string;
      minPrice: number;
      imageUrl?: string;
    }>();
    const responses = await Promise.all(
      expandSearchQueries(q).map((searchQuery) =>
        fetch(
          `${apiUrl}/store/search/suggestions?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        ),
      ),
    );
    for (const response of responses) {
      if (!response.ok) throw new Error(`worker_catalog_${response.status}`);
      const payload = (await response.json()) as {
        suggestions?: Array<{
          slug?: unknown;
          name?: unknown;
          minPrice?: unknown;
          imageUrl?: unknown;
        }>;
      };
      for (const suggestion of payload.suggestions ?? []) {
        if (
          typeof suggestion.slug === "string" &&
          typeof suggestion.name === "string" &&
          typeof suggestion.minPrice === "number" &&
          Number.isFinite(suggestion.minPrice) &&
          (suggestion.imageUrl === undefined || typeof suggestion.imageUrl === "string")
        ) {
          suggestionsBySlug.set(suggestion.slug, {
            slug: suggestion.slug,
            name: suggestion.name,
            minPrice: suggestion.minPrice,
            ...(typeof suggestion.imageUrl === "string" ? { imageUrl: suggestion.imageUrl } : {}),
          });
        }
      }
    }
    return NextResponse.json(
      { suggestions: rankSearchSuggestions([...suggestionsBySlug.values()], q).slice(0, 8) },
      { headers: SUGGESTION_CACHE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { suggestions: [], error: "catalog_unavailable" },
      { status: 503 },
    );
  }
}
