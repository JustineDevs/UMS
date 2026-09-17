import { medusaAdminFetch } from "@/lib/medusa-admin-http";

export type AdminProductCategoryRow = {
  id: string;
  name: string;
  handle: string;
};

function slugFromCategoryName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) || "category"
  );
}

export type CreateCategoryResult =
  | { ok: true; category: AdminProductCategoryRow }
  | { ok: false; message: string };

/**
 * Creates a product category in Medusa (same list the shop uses for filters).
 */
export async function createAdminProductCategory(input: {
  name: string;
  handle?: string;
}): Promise<CreateCategoryResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, message: "Category name is required." };
  }
  const handle = (input.handle?.trim() || slugFromCategoryName(name)).slice(
    0,
    200,
  );
  try {
    const res = await medusaAdminFetch("/admin/product-categories", {
      method: "POST",
      body: JSON.stringify({
        name,
        handle,
        is_active: true,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        typeof j.message === "string" && j.message.trim()
          ? j.message
          : "Store could not create the category.";
      return { ok: false, message: msg };
    }
    const c = (j.product_category ?? j.productCategory) as
      | { id?: string; name?: string; handle?: string }
      | undefined;
    const id =
      c?.id != null
        ? String(c.id)
        : typeof j.id === "string" && j.id.trim()
          ? j.id.trim()
          : "";
    if (!id) {
      return { ok: false, message: "Create succeeded but category id was missing." };
    }
    return {
      ok: true,
      category: {
        id,
        name: String(c?.name ?? name),
        handle: String(c?.handle ?? handle),
      },
    };
  } catch {
    return { ok: false, message: "Store connection failed." };
  }
}

/**
 * Lists Medusa product categories for catalog assignment (same data the shop uses for filters).
 */
export async function listAdminProductCategories(): Promise<
  AdminProductCategoryRow[]
> {
  try {
    const res = await medusaAdminFetch(
      "/admin/product-categories?limit=200&fields=id,name,handle",
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      product_categories?: Array<{
        id?: string;
        name?: string;
        handle?: string;
      }>;
    };
    return (j.product_categories ?? []).map((c) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      handle: String(c.handle ?? ""),
    }));
  } catch {
    return [];
  }
}
