"use client";

import { AdminPageHeader } from "@/components/admin-console";
import { CatalogMediaManager } from "@/components/catalog/CatalogMediaManager";

export default function CatalogMediaPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="Catalog media"
        subtitle="Upload, organize, and maintain the assets used by products and storefront content."
      />
      <CatalogMediaManager />
    </div>
  );
}
