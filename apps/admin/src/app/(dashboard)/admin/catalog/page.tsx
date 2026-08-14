import Image from "next/image";
import Link from "next/link";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AuditTimeline,
  CrudManagerLayout,
} from "@/components/admin-console";
import { AdminTechnicalDetails } from "@/components/AdminTechnicalDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchMedusaProductsListForAdmin,
  getMedusaAdminProductEditUrl,
  getMedusaAdminProductsIndexUrl,
  type MedusaProductListRow,
} from "@/lib/medusa-catalog-bridge";
import {
  aggregateStockAvailableByProductId,
  fetchAllMedusaInventoryRows,
} from "@/lib/medusa-inventory-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";

function formatAggregatedStock(
  p: MedusaProductListRow,
  stockByProduct: Map<string, number>,
): string {
  if (p.variantCount === 0) return "—";
  if (!stockByProduct.has(p.id)) return "—";
  return String(stockByProduct.get(p.id) ?? 0);
}

export const dynamic = "force-dynamic";

const CATALOG_FLASH_MESSAGES: Record<string, string> = {
  created: "Product created.",
  updated: "Changes saved.",
  deleted: "Product removed.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    flash?: string;
    page?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  await requirePagePermission("catalog:read");
  const {
    q,
    flash,
    page: pageParam,
    status: statusParam,
    sort: sortParam,
  } = await searchParams;
  const query = q?.trim() ?? "";
  const status = ["draft", "published", "rejected"].includes(statusParam ?? "")
    ? statusParam!
    : "";
  const sort = ["-created_at", "title", "-title"].includes(sortParam ?? "")
    ? (sortParam as "-created_at" | "title" | "-title")
    : "-created_at";
  const pageSize = 25;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const flashKey = typeof flash === "string" ? flash.trim() : "";
  const flashText = flashKey
    ? (CATALOG_FLASH_MESSAGES[flashKey] ?? null)
    : null;
  const catalogHref = (
    overrides: {
      page?: number;
      q?: string;
      status?: string;
      sort?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    const nextQuery = overrides.q ?? query;
    const nextStatus = overrides.status ?? status;
    const nextPage = overrides.page ?? page;
    const nextSort = overrides.sort ?? sort;
    if (nextQuery) params.set("q", nextQuery);
    if (nextStatus) params.set("status", nextStatus);
    if (nextSort !== "-created_at") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));
    const encoded = params.toString();
    return encoded ? `/admin/catalog?${encoded}` : "/admin/catalog";
  };
  const catalogDismissHref = catalogHref({ page: 1 });
  const { products, count, commerceUnavailable } =
    await fetchMedusaProductsListForAdmin({
      q: query,
      status,
      order: sort,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const currentPage = Math.min(page, pageCount);

  const inventoryRows = commerceUnavailable
    ? []
    : await fetchAllMedusaInventoryRows({ batchSize: 100 });
  const stockByProduct = aggregateStockAvailableByProductId(inventoryRows);

  const shopOrigin = getStorefrontPublicOrigin();

  const fullEditorUrl = getMedusaAdminProductsIndexUrl();

  const commerceBanner = commerceUnavailable ? (
    <div className="rounded border border-outline-variant/30 bg-surface-container-high px-4 py-3 text-sm">
      <p className="font-medium text-primary">Store service unavailable</p>
      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
        Wait until the commerce service has finished starting, then refresh. The
        list below needs that connection.
      </p>
    </div>
  ) : null;

  const flashBanner = flashText ? (
    <div className="rounded-lg border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{flashText}</p>
        <Link
          href={catalogDismissHref}
          className="shrink-0 text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          Dismiss
        </Link>
      </div>
    </div>
  ) : null;

  const bannerSlot =
    commerceBanner || flashBanner ? (
      <div className="space-y-4">
        {commerceBanner}
        {flashBanner}
      </div>
    ) : null;

  const filters = (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {commerceUnavailable
            ? "—"
            : `${count} product${count === 1 ? "" : "s"} found`}
        </p>
        <p className="text-xs text-muted-foreground">
          Showing {count === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, count)}
        </p>
      </div>
      <form
        action="/admin/catalog"
        method="get"
        className="flex w-full max-w-xl flex-wrap gap-2 sm:flex-nowrap"
      >
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by name or handle"
          className="min-w-0 flex-1"
          aria-label="Search products"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter products by status"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          name="sort"
          defaultValue={sort}
          aria-label="Sort products"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="-created_at">Newest</option>
          <option value="title">Name A-Z</option>
          <option value="-title">Name Z-A</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>
    </div>
  );

  const actions = (
    <>
      <Button asChild variant="outline">
        <Link href="/admin">Back to dashboard</Link>
      </Button>
      <Button asChild>
        <Link href="/admin/catalog/new">Add product</Link>
      </Button>
      <Button asChild variant="outline">
        <a href={fullEditorUrl} target="_blank" rel="noopener noreferrer">
          Open full catalog in store admin
        </a>
      </Button>
    </>
  );

  return (
    <CrudManagerLayout
      title="Products"
      subtitle="Published products and categories match what shoppers see. Stock is the total available units across variants. Use the full store admin for complex pricing and many variants per product."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Products" },
          ]}
        />
      }
      bannerSlot={bannerSlot}
      filters={filters}
      actions={actions}
      inspector={
        <AuditTimeline
          resourcePrefix="product:"
          title="Recent catalog changes"
        />
      }
    >
      <div className="mb-6 flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-outline-variant/15 bg-surface-container-low/80 px-4 py-3 text-sm">
        <span className="font-semibold text-on-surface">Connected areas</span>
        <Link className="text-primary hover:underline" href="/admin/inventory">
          Inventory
        </Link>
        <span className="text-on-surface-variant/50" aria-hidden>
          |
        </span>
        <Link className="text-primary hover:underline" href="/admin/orders">
          Orders
        </Link>
        <span className="text-on-surface-variant/50" aria-hidden>
          |
        </span>
        <Link className="text-primary hover:underline" href="/admin/pos">
          POS
        </Link>
        <span className="text-on-surface-variant/50" aria-hidden>
          |
        </span>
        <a
          className="text-primary hover:underline"
          href={`${shopOrigin}/shop`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Storefront shop
        </a>
      </div>

      <AdminTechnicalDetails className="mb-6 max-w-3xl">
        <p>
          The full store admin opens in a new tab for advanced edits. Stock
          totals need a warehouse link for each item. If stock shows a dash,
          open Inventory or the full store admin to set quantities.
        </p>
      </AdminTechnicalDetails>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Catalog products</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden lg:table-cell">Shop</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden sm:table-cell">Variants</TableHead>
                <TableHead className="hidden text-right xl:table-cell">
                  Stock
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <AdminEmptyState
                      title={
                        commerceUnavailable
                          ? "Catalog unavailable"
                          : query || status
                            ? "No matching products"
                            : "No products yet"
                      }
                      description={
                        commerceUnavailable
                          ? "The commerce service is offline. Refresh after it finishes starting."
                          : query || status
                            ? "Change the search or status filter to see other products."
                            : "Create the first product to make it available to the storefront."
                      }
                      action={
                        !commerceUnavailable ? (
                          <Button asChild size="sm">
                            <Link href="/admin/catalog/new">Add product</Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                          {p.thumbnail ? (
                            <Image
                              src={p.thumbnail}
                              alt=""
                              fill
                              unoptimized
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-on-surface-variant">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary">
                            {p.title || "Untitled"}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {p.handle}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] align-top lg:table-cell">
                      <p className="text-xs text-on-surface-variant">
                        <span className="font-semibold text-on-surface">
                          Categories:{" "}
                        </span>
                        {p.categorySummary}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        <span className="font-semibold text-on-surface">
                          Size / Color:{" "}
                        </span>
                        {p.sizeColorSummary}
                      </p>
                      {p.shopNotes.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-[11px] text-amber-900">
                          {p.shopNotes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden capitalize md:table-cell">
                      <Badge
                        variant={
                          p.status === "published" ? "default" : "outline"
                        }
                      >
                        {p.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {p.variantCount}
                    </TableCell>
                    <TableCell
                      className="hidden text-right font-mono text-muted-foreground xl:table-cell"
                      title="Available units summed across variants (inventory)"
                    >
                      {formatAggregatedStock(p, stockByProduct)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-3">
                        <Link
                          href={`/admin/catalog/${p.id}`}
                          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                        >
                          Edit here
                        </Link>
                        <a
                          href={getMedusaAdminProductEditUrl(p.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant hover:underline"
                        >
                          Store admin
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pageCount > 1 ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {pageCount}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={catalogHref({ page: Math.max(1, currentPage - 1) })}
                  aria-disabled={currentPage === 1}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink
                  href={catalogHref({ page: currentPage })}
                  isActive
                >
                  {currentPage}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href={catalogHref({
                    page: Math.min(pageCount, currentPage + 1),
                  })}
                  aria-disabled={currentPage === pageCount}
                  className={
                    currentPage === pageCount
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-on-surface-variant">
        Orders, inventory, and point of sale share the same catalog as checkout.
        Stock is available quantity when each variant is linked to inventory.
        Rules for collections, discounts, and shipping are managed in the full
        store admin.
      </p>
    </CrudManagerLayout>
  );
}
