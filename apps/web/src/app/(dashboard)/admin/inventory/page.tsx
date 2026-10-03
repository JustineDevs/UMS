import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader, AdminPageShell } from "@/components/admin-console";
import { InventoryDefaultQuerySync } from "@/components/InventoryDefaultQuerySync";
import { InventoryTableWithRefresh } from "@/components/InventoryTableWithRefresh";
import { fetchInventoryPage } from "@/lib/inventory-admin-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZES = [25, 50, 100] as const;

function parsePaging(sp: { page?: string; pageSize?: string }): {
  page: number;
  pageSize: (typeof ALLOWED_PAGE_SIZES)[number];
} {
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const raw = parseInt(sp.pageSize ?? "25", 10);
  const pageSize = ALLOWED_PAGE_SIZES.includes(raw as (typeof ALLOWED_PAGE_SIZES)[number])
    ? (raw as (typeof ALLOWED_PAGE_SIZES)[number])
    : 25;
  return { page, pageSize };
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await requirePagePermission("inventory:read");
  const sp = await searchParams;
  const { page, pageSize } = parsePaging(sp);
  const offset = (page - 1) * pageSize;
  const result = await fetchInventoryPage({ limit: pageSize, offset });
  const totalPages =
    result.total > 0 ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
  if (result.total > 0 && page > totalPages) {
    redirect(`/admin/inventory?page=${totalPages}&pageSize=${pageSize}`);
  }

  return (
    <AdminPageShell
      hideHeader
    >
      <AdminPageHeader
        title="Inventory"
        subtitle={`Stock control · ${result.total} catalog variant${result.total === 1 ? "" : "s"} currently tracked`}
        actions={
          <Link
            href="/admin/catalog/new"
            className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-950"
          >
            Add product
          </Link>
        }
      />
      <Suspense
        fallback={
          <div
            className="mb-4 h-5 w-56 animate-pulse rounded bg-surface-container-low"
            role="status"
            aria-label="Loading inventory preferences"
          />
        }
      >
        <InventoryDefaultQuerySync />
      </Suspense>
      <InventoryTableWithRefresh
        key={`${page}-${pageSize}`}
        initialRows={result.rows}
        page={page}
        pageSize={pageSize}
        total={result.total}
      />
    </AdminPageShell>
  );
}
