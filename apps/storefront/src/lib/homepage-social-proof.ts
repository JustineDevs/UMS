import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { unstable_cache } from "next/cache";

export type HomepageSocialProof = {
  average: number;
  count: number;
};

async function fetchHomepageCustomerCountUncached(): Promise<number> {
  try {
    const res = await medusaAdminFetch("/admin/customers?limit=1&fields=id");
    if (!res.ok) {
      return 0;
    }
    const json = (await res.json()) as {
      count?: number;
      total?: number;
      customers?: unknown[];
    };
    if (typeof json.count === "number") {
      return json.count;
    }
    if (typeof json.total === "number") {
      return json.total;
    }
    return Array.isArray(json.customers) ? json.customers.length : 0;
  } catch {
    return 0;
  }
}

export const fetchHomepageCustomerCount = unstable_cache(
  fetchHomepageCustomerCountUncached,
  ["storefront-home-customer-count"],
  { revalidate: 60, tags: ["storefront:home", "storefront:customer-count"] },
);

async function fetchHomepageSocialProofUncached(): Promise<HomepageSocialProof> {
  const supabase = createStorefrontServiceSupabase();
  if (!supabase) {
    return { average: 0, count: 0 };
  }

  const pageSize = 1000;
  let offset = 0;
  let total = 0;
  let ratingSum = 0;

  for (;;) {
    const { data, error, count: exactCount } = await supabase
      .from("product_reviews")
      .select("rating", { count: "exact" })
      .eq("status", "approved")
      .eq("shadow_banned", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error || !data) {
      return { average: 0, count: 0 };
    }

    if (offset === 0) {
      total = typeof exactCount === "number" ? exactCount : data.length;
    }

    for (const row of data as Array<{ rating?: number }>) {
      const rating = Number(row.rating);
      if (Number.isFinite(rating)) {
        ratingSum += rating;
      }
    }

    if (data.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return {
    count: total,
    average: total > 0 ? ratingSum / total : 0,
  };
}

export const fetchHomepageSocialProof = unstable_cache(
  fetchHomepageSocialProofUncached,
  ["storefront-home-social-proof"],
  { revalidate: 60, tags: ["storefront:home", "storefront:reviews"] },
);
