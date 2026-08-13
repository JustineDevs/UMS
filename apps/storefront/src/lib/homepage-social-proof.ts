import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export type HomepageSocialProof = {
  average: number;
  count: number;
};

export async function fetchHomepageCustomerCount(): Promise<number> {
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

export async function fetchHomepageSocialProof(): Promise<HomepageSocialProof> {
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
